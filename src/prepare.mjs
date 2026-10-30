import { buildTimeline } from "./timeline.mjs";
import { planShots } from "./shot-planner.mjs";
import { synthesize, mixEpisode } from "./audio.mjs";

export function prepareEpisode(script) {
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
