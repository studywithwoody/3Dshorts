import { buildTimeline } from "./timeline.mjs";
import { planShots } from "./shot-planner.mjs";
import { envelopeFromSamples, mixEpisode, synthesize } from "./audio.mjs";
import { synthesizeSpeech } from "./tts/index.mjs";

export async function prepareEpisode(script) {
  if (script.scene === "study" || script.tts) return prepareSpeechEpisode(script);
  return prepareSynthEpisode(script);
}

function prepareSynthEpisode(script) {
  const timeline = buildTimeline(script);
  const shots = planShots(timeline);
  const characters = (script.characters ?? []).map((ch) => {
    if (!ch.id || !ch.model) throw new Error(`角色缺少 id 或 model：${JSON.stringify(ch)}`);
    if (!Array.isArray(ch.position) || ch.position.length < 3) {
      throw new Error(`角色 ${ch.id} 需要 position: [x, y, z]`);
    }
    return {
      id: ch.id,
      model: ch.model,
      position: ch.position.slice(0, 3),
      rotationY: ch.rotationY ?? 0,
      scale: ch.scale ?? 1,
      sound: ch.sound ?? null,
      caption: ch.caption ?? null,
    };
  });

  const known = new Set(characters.map((ch) => ch.id));
  for (const line of timeline.lines) {
    if (!known.has(line.speaker)) {
      throw new Error(`台詞指向未知角色「${line.speaker}」`);
    }
    const ch = characters.find((c) => c.id === line.speaker);
    if (!line.sound) line.sound = ch.sound;
    if (!line.caption) line.caption = ch.caption ?? "";
    if (!line.sound) throw new Error(`第 ${line.index} 句沒有音效`);
    if (line.duringPause?.target && !known.has(line.duringPause.target)) {
      throw new Error(`duringPause 目標未知：${line.duringPause.target}`);
    }
    if (
      line.duringPause?.actor &&
      line.duringPause.actor !== "*" &&
      !known.has(line.duringPause.actor)
    ) {
      throw new Error(`duringPause 角色未知：${line.duringPause.actor}`);
    }
  }

  const clips = {};
  const envelopes = {};
  for (const line of timeline.lines) {
    if (clips[line.sound]) continue;
    clips[line.sound] = synthesize(line.sound);
    envelopes[line.sound] = clips[line.sound].envelope;
  }
  for (const line of timeline.lines) {
    line.soundDuration = clips[line.sound].duration;
    if (line.soundDuration > line.duration + 1e-3) {
      throw new Error(
        `${line.sound} 長度 ${line.soundDuration.toFixed(2)}s 超過台詞 duration ${line.duration}s（${line.speaker}）`,
      );
    }
  }

  const audio = mixEpisode({
    clips,
    lines: timeline.lines,
    duration: timeline.duration,
  });

  const bundle = {
    id: timeline.id,
    title: timeline.title,
    fps: timeline.fps,
    width: timeline.width,
    height: timeline.height,
    duration: timeline.duration,
    intro: timeline.intro,
    endOfLines: timeline.endOfLines,
    finale: timeline.finale,
    characters,
    lines: timeline.lines.map((line) => ({
      index: line.index,
      speaker: line.speaker,
      action: line.action ?? "hop",
      sound: line.sound,
      caption: line.caption,
      duration: line.duration,
      pauseAfter: line.pauseAfter,
      start: line.start,
      blockEnd: line.blockEnd,
      soundDuration: line.soundDuration,
      shot: line.shot ?? null,
      secondary: line.secondary ?? null,
      duringPause: line.duringPause ?? null,
    })),
    shots,
    envelopes,
  };

  return { bundle, audio, clips, shots, timeline };
}

async function prepareSpeechEpisode(script) {
  const provider = script.tts?.provider ?? "edge";
  const rate = script.tts?.rate ?? "+0%";
  const cacheDir = script.tts?.cache ?? "cache/tts";
  const voices = script.voices ?? {};
  const characters = (script.characters ?? []).map((ch) => {
    if (!ch.id || !ch.model) throw new Error(`角色缺少 id 或 model：${JSON.stringify(ch)}`);
    return {
      id: ch.id,
      name: ch.name ?? ch.id,
      model: ch.model,
      skin: ch.skin ?? null,
      clips: ch.clips ?? {},
      position: (ch.position ?? [0, 0, 0]).slice(0, 3),
      rotationY: ch.rotationY ?? 0,
      scale: ch.scale ?? 1,
      voice: ch.voice ?? voices[ch.id] ?? null,
    };
  });

  const spoken = [];
  for (const [index, line] of (script.lines ?? []).entries()) {
    if (!line.text) throw new Error(`第 ${index} 句缺少 text`);
    const voice = line.voice || voices[line.speaker] || characters.find((c) => c.id === line.speaker)?.voice;
    if (!voice) throw new Error(`第 ${index} 句「${line.speaker}」沒有 voice`);
    const speech = await synthesizeSpeech({
      provider,
      voice,
      text: line.text,
      rate: line.rate || rate,
      cacheDir,
    });
    spoken.push({
      ...line,
      voice,
      audioDuration: speech.duration,
      words: speech.words,
      sentences: speech.sentences,
      samples: speech.samples,
      sampleRate: speech.sampleRate,
    });
    console.log(
      `語音 ${line.speaker} ${speech.duration.toFixed(2)}s  ${speech.sentences.length} 句 / ${speech.words.length} 詞  「${line.text}」`,
    );
  }

  const target = script.duration ?? 30;
  const fitted = fitBeats(spoken, target);
  let cursor = script.intro ?? 0;
  for (const line of fitted) cursor += line.duration + line.pauseAfter;

  const timeline = buildTimeline({
    ...script,
    lines: fitted.map((line) => ({
      speaker: line.speaker,
      text: line.text,
      caption: line.text,
      action: line.action ?? "stare",
      ui: line.ui ?? "homework",
      focus: line.focus ?? "laptop",
      shotCycle: line.shotCycle ?? null,
      sfx: line.sfx ?? null,
      sfxDelay: line.sfxDelay ?? 0,
      sfxGain: line.sfxGain ?? 0.8,
      duration: line.duration,
      pauseAfter: line.pauseAfter,
      voice: line.voice,
      words: line.words,
      sentences: line.sentences,
      audioKey: line.audioKey,
    })),
    duration: cursor,
    planner: script.planner ?? "cycle",
  });

  for (const line of timeline.lines) {
    const source = fitted[line.index];
    line.soundDuration = source.audioDuration;
    line.envelope = envelopeFromSamples(source.samples, source.sampleRate);
    line.audioKey = `line-${line.index}`;
    line.words = source.words;
    line.sentences = source.sentences;
  }

  const shots = planShots(timeline);
  const clips = {};
  for (const line of timeline.lines) {
    const source = fitted[line.index];
    clips[line.audioKey] = {
      name: line.audioKey,
      samples: source.samples,
      sampleRate: source.sampleRate,
      duration: source.audioDuration,
      envelope: line.envelope,
    };
  }
  const sfxNames = new Set(timeline.lines.map((line) => line.sfx).filter(Boolean));
  for (const name of sfxNames) clips[name] = synthesize(name);

  const audio = mixEpisode({
    clips,
    lines: timeline.lines,
    duration: timeline.duration,
    bed: script.music === "day" ? "day" : "night",
  });

  const bundle = {
    id: timeline.id,
    title: timeline.title,
    scene: "study",
    fps: timeline.fps,
    width: timeline.width,
    height: timeline.height,
    duration: timeline.duration,
    intro: timeline.intro,
    endOfLines: timeline.endOfLines,
    finale: timeline.finale,
    brand: script.brand ?? { name: "AI 學習平台", icon: "spark", color: "#F6C453" },
    voices,
    tts: { provider, rate },
    characters,
    lines: timeline.lines.map((line) => ({
      index: line.index,
      speaker: line.speaker,
      text: line.text,
      action: line.action,
      ui: line.ui,
      focus: line.focus,
      shotCycle: line.shotCycle,
      sfx: line.sfx,
      sfxDelay: line.sfxDelay,
      sfxGain: line.sfxGain,
      caption: line.caption,
      voice: line.voice,
      duration: line.duration,
      pauseAfter: line.pauseAfter,
      start: line.start,
      blockEnd: line.blockEnd,
      soundDuration: line.soundDuration,
      audioKey: line.audioKey,
      words: line.words,
      sentences: line.sentences,
      envelope: line.envelope,
    })),
    shots,
    envelopes: Object.fromEntries(timeline.lines.map((line) => [line.audioKey, line.envelope])),
  };

  return { bundle, audio, clips, shots, timeline };
}

function fitBeats(items, target) {
  const blocks = items.map((item, index) => {
    const speech = item.audioDuration;
    const beat = Number(item.beat ?? speech);
    let pauseAfter = 0.1;
    if (speech + 0.1 < beat) pauseAfter = beat - speech;
    return {
      ...item,
      audioKey: `line-${index}`,
      duration: speech,
      pauseAfter,
    };
  });
  const total = () => blocks.reduce((sum, block) => sum + block.duration + block.pauseAfter, 0);
  let overflow = total() - target;
  if (overflow > 0.3) {
    for (const block of blocks) {
      const spare = Math.max(0, block.pauseAfter - 0.08);
      const cut = Math.min(spare, overflow);
      block.pauseAfter -= cut;
      overflow -= cut;
    }
  } else if (total() < target - 0.2) {
    const add = (target - total()) / blocks.length;
    for (const block of blocks) block.pauseAfter += add;
  }
  for (const block of blocks) {
    block.duration = Math.round(block.duration * 1000) / 1000;
    block.pauseAfter = Math.round(Math.max(0, block.pauseAfter) * 1000) / 1000;
    if (block.duration + block.pauseAfter < 0.8) {
      block.pauseAfter = Math.round((0.8 - block.duration) * 1000) / 1000;
    }
  }
  const drift = Math.round((target - total()) * 1000) / 1000;
  if (blocks.length && drift > 0 && drift < 2) {
    blocks[blocks.length - 1].pauseAfter =
      Math.round((blocks[blocks.length - 1].pauseAfter + drift) * 1000) / 1000;
  }
  return blocks;
}
