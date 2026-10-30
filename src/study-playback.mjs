/**
 * Deterministic poses for the study-room episode.
 * Mouth opening follows edge-tts word boundaries, scaled by the amplitude envelope.
 */

import { sampleEnvelope } from "./playback.mjs";
import { CAMERAS, EYE_Y, OTS, STUDENT_HOME } from "./study-layout.mjs";

const LOOK = {
  stare: { pitch: 0.16, yaw: 0.02, clip: "idle" },
  phone: { pitch: 0.42, yaw: -0.28, clip: "idle" },
  search: { pitch: 0.32, yaw: 0.04, clip: "idle" },
  upload: { pitch: 0.24, yaw: -0.06, clip: "idle" },
  tutor: { pitch: 0.08, yaw: 0.38, clip: "idle" },
  solve: { pitch: -0.22, yaw: 0.0, clip: "jump", once: true },
  logo: { pitch: 0.02, yaw: 0.0, clip: "idle" },
};

function shotAt(shots, t) {
  for (const shot of shots) {
    if (t >= shot.start && t < shot.end) return shot;
  }
  return shots[shots.length - 1] ?? null;
}

function lineAt(lines, t) {
  for (const line of lines) {
    if (t >= line.start && t < line.blockEnd) return line;
  }
  return null;
}

export function mouthOpen(line, localT) {
  if (!line || localT < -0.02) return 0;
  const words = line.words ?? [];
  let gate = 0;
  for (const word of words) {
    const start = word.start - 0.02;
    const end = word.end + 0.035;
    if (localT < start || localT > end) continue;
    const span = Math.max(0.06, word.end - word.start);
    const u = Math.min(1, Math.max(0, (localT - word.start) / span));
    const syllable = Math.sin(Math.PI * u);
    const flaps = 2 + Math.min(3, [...word.text].length);
    const flap = 0.42 + 0.58 * Math.abs(Math.sin(u * Math.PI * flaps));
    gate = Math.max(gate, syllable * flap);
  }
  if (gate <= 0) return 0;
  const env = line.envelope ? sampleEnvelope(line.envelope, localT) : 0.65;
  return Math.max(0, Math.min(1, gate * (0.4 + 0.7 * env)));
}

function studentPose(bundle, t) {
  const ch = bundle.characters[0];
  const home = ch?.position ?? STUDENT_HOME.position;
  const baseYaw = ch?.rotationY ?? STUDENT_HOME.rotationY;
  const line = lineAt(bundle.lines, t);
  const action = line?.action ?? "stare";
  const look = LOOK[action] ?? LOOK.stare;
  const localT = line ? t - line.start : 0;
  const speaking = line && localT >= 0 && localT < (line.soundDuration ?? line.duration);
  const mouth = speaking ? mouthOpen(line, localT) : 0;
  const nod = Math.sin(localT * 10.5) * 0.05 * mouth;
  let hop = 0;
  if (action === "solve") {
    const u = Math.min(1, Math.max(0, localT / 0.85));
    hop = Math.sin(u * Math.PI) * 0.32;
  }
  const reach = action === "solve" || action === "logo" ? 0.05 : action === "phone" ? 0.55 : 0.28;
  return {
    position: [home[0], home[1] + hop, home[2]],
    yaw: baseYaw,
    hop,
    clip: look.clip,
    clipTime: look.once ? Math.max(0, localT) : t,
    once: Boolean(look.once),
    headPitch: look.pitch + nod,
    headYaw: look.yaw + Math.sin(localT * 3.1) * 0.03 * mouth,
    mouth,
    reach,
    scale: [1, 1, 1],
  };
}

function cameraFor(shot, pose) {
  if (!shot || shot.type === "wide") return { ...CAMERAS.wide };
  if (shot.type === "logo") return { ...CAMERAS.logo };
  if (shot.type === "closeup") {
    if (pose.clip === "jump") return { ...CAMERAS.jump };
    const head = [pose.position[0], pose.position[1] + EYE_Y, pose.position[2]];
    const close = CAMERAS.close;
    const yaw = pose.yaw || Math.PI;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    return {
      fov: close.fov,
      position: [
        head[0] + fx * close.distance + fz * close.side,
        head[1] + close.lift,
        head[2] + fz * close.distance - fx * close.side,
      ],
      lookAt: [head[0] - fx * 0.04, head[1] - close.lookDown, head[2] - fz * 0.04],
    };
  }
  const focus = shot.focus && OTS[shot.focus] ? shot.focus : "laptop";
  return { ...OTS[focus] };
}

function captionFor(bundle, t) {
  for (const line of bundle.lines) {
    const soundDuration = line.soundDuration ?? line.duration;
    if (t < line.start || t >= line.start + soundDuration) continue;
    if (!line.caption && !line.text) continue;
    const local = t - line.start;
    let text = line.caption || line.text;
    if (line.sentences?.length > 1) {
      const spoken = line.sentences.find(
        (sentence) => local >= sentence.start - 0.05 && local < sentence.end + 0.22,
      );
      if (spoken?.text) text = spoken.text;
    }
    const logo = line.ui === "logo";
    return {
      text,
      pop: 1,
      family: "Noto Sans TC",
      size: logo ? 52 : 64,
      y: logo ? 0.64 : 0.9,
      maxWidth: 920,
    };
  }
  return null;
}

function screensFor(bundle, t) {
  const line = lineAt(bundle.lines, t);
  const ui = line?.ui ?? "homework";
  const local = line ? t - line.start : 0;
  const brand = bundle.brand?.name ?? "AI 學習平台";
  return {
    laptop: {
      mode: ui === "phone" || ui === "homework" ? "dim" : ui,
      progress: ui === "upload" ? Math.max(0, Math.min(1, local / 1.35)) : ui === "tutor" || ui === "solved" ? 1 : 0,
      brand,
    },
    phone: {
      mode: ui === "phone" ? "chat" : "lock",
      flash: ui === "phone" && local < 0.22,
    },
    paper: { mode: ui === "solved" ? "solved" : "problem" },
    ai: { visible: ui === "tutor", text: line?.text ?? "", brand },
    clock: "01:00",
  };
}

export function evaluate(bundle, t) {
  const shot = shotAt(bundle.shots, t);
  const pose = studentPose(bundle, t);
  const line = lineAt(bundle.lines, t);
  const local = line ? t - line.start : 0;
  const shake =
    line?.action === "solve" ? Math.exp(-local * 5) * Math.sin(local * 42) * 0.07 : 0;
  const logo = shot?.type === "logo" || line?.ui === "logo";
  return {
    t,
    shot,
    poses: { student: pose },
    camera: cameraFor(shot, pose),
    caption: captionFor(bundle, t),
    screens: screensFor(bundle, t),
    shake,
    overlay: logo
      ? {
          kind: "logo",
          name: bundle.brand?.name ?? "AI 學習平台",
          icon: bundle.brand?.icon ?? "spark",
          color: bundle.brand?.color ?? "#F6C453",
        }
      : null,
  };
}
