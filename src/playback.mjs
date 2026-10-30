/**
 * Pure function of time. Given a prepared episode bundle, returns camera,
 * caption, prop and per-character poses. No clocks, no randomness.
 *
 * Close-ups exile everyone except the speaker: the cut hides the reposition,
 * and the speaker stays large and unoccluded in the vertical frame.
 */

const FRAMING = {
  wide: {
    fov: 48,
    position: [0.0, 1.7, 6.45],
    lookAt: [0.0, 0.58, 0.02],
  },
  close: {
    fov: 30,
    distance: 4.85,
    lookHeight: 0.7,
    side: 0.18,
    lift: 0.22,
  },
  two: {
    fov: 38,
    distance: 4.15,
    lookHeight: 0.58,
    lift: 0.42,
  },
};

const MAX_LOOK = 0.42;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  const d = wrapPi(b - a);
  return a + d * t;
}

function wrapPi(d) {
  return ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function phaseOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

export function sampleEnvelope(env, localT) {
  if (!env || localT < 0 || localT > env.duration) return 0;
  const values = env.values;
  if (!values.length) return 0;
  const i = (localT * env.sampleRate) / env.hop;
  const i0 = clamp(Math.floor(i), 0, values.length - 1);
  const i1 = Math.min(values.length - 1, i0 + 1);
  const f = clamp(i - i0, 0, 1);
  return values[i0] * (1 - f) + values[i1] * f;
}

function shotAt(shots, t) {
  for (const shot of shots) {
    if (t >= shot.start && t < shot.end) return shot;
  }
  return shots[shots.length - 1];
}

function characterById(bundle, id) {
  return bundle.characters.find((ch) => ch.id === id);
}

function focusId(bundle, t) {
  for (const line of bundle.lines) {
    if (!line.duringPause || line.duringPause.actor === "*") continue;
    const p0 = line.start + line.duration;
    if (t >= p0 && t < line.blockEnd) return line.duringPause.actor;
  }
  let speaker = null;
  for (const line of bundle.lines) {
    if (line.start <= t) speaker = line.speaker;
  }
  return speaker;
}

function applyAction(state, action, u, ctx) {
  const uu = clamp(u, 0, 1);
  state.clipOrigin = ctx.origin;
  state.lockYaw = true;

  if (action === "hop") {
    state.clip = "gesture-positive";
    state.hop = Math.abs(Math.sin(uu * Math.PI * 2)) * 0.42;
  } else if (action === "spin") {
    state.clip = "dance";
    state.yaw = state.yaw0 + Math.sin(uu * Math.PI * 2) * 0.5;
    state.hop = Math.abs(Math.sin(uu * Math.PI * 2)) * 0.12;
  } else if (action === "dance") {
    state.clip = "dance";
    state.hop = Math.abs(Math.sin(uu * Math.PI * 3)) * 0.16;
  } else if (action === "bounce") {
    state.clip = "idle";
    state.hop = Math.abs(Math.sin(uu * Math.PI * 4)) * 0.26;
    state.bounce = 1;
  } else if (action === "chase") {
    state.clip = "run";
    const k = Math.sin(uu * Math.PI);
    const target = ctx.targetPos;
    state.position[0] = lerp(state.home[0], target[0], k * 0.22);
    state.position[2] = state.home[2] + k * 0.38;
    state.yaw = state.yaw0 + Math.sin(uu * Math.PI * 2) * 0.28;
  } else if (action === "celebrate") {
    state.clip = "dance";
    state.hop = Math.abs(Math.sin(uu * Math.PI * 4 + ctx.phase)) * 0.18;
    state.yaw = state.yaw0 + Math.sin(uu * Math.PI * 4 + ctx.phase) * 0.45;
  } else if (action === "gesture-positive" || action === "gesture-negative") {
    state.clip = action;
    state.hop = Math.sin(uu * Math.PI) * 0.12;
  } else {
    state.clip = "idle";
    state.lockYaw = false;
  }
}

function basePose(ch, bundle, t) {
  const phase = phaseOf(ch.id);
  const home = ch.position;
  const state = {
    id: ch.id,
    home,
    yaw0: ch.rotationY ?? 0,
    position: [home[0], 0, home[2]],
    yaw: ch.rotationY ?? 0,
    clip: "idle",
    clipOrigin: 0,
    hop: 0,
    spin: 0,
    bounce: 0,
    talk: 0,
    lean: 0,
    lockYaw: false,
    scale: [1, 1, 1],
    phase,
  };

  const performing = bundle.lines.find(
    (line) => line.speaker === ch.id && t >= line.start && t < line.start + line.duration,
  );
  if (performing) {
    const u = (t - performing.start) / performing.duration;
    applyAction(state, performing.action || "hop", u, {
      origin: performing.start,
      phase,
      targetPos: home,
    });
  } else {
    const pause = bundle.lines.find((line) => {
      if (!line.duringPause) return false;
      const actor = line.duringPause.actor;
      if (actor !== "*" && actor !== ch.id) return false;
      const p0 = line.start + line.duration;
      return t >= p0 && t < line.blockEnd;
    });
    if (pause) {
      const p0 = pause.start + pause.duration;
      const u = (t - p0) / (pause.blockEnd - p0);
      const target = characterById(bundle, pause.duringPause.target);
      applyAction(state, pause.duringPause.action || "dance", u, {
        origin: p0,
        phase,
        targetPos: target ? target.position : [0, 0, 0],
      });
    } else if (t >= bundle.endOfLines && bundle.finale) {
      const span = Math.max(0.001, bundle.duration - bundle.endOfLines);
      const u = (t - bundle.endOfLines) / span;
      applyAction(state, bundle.finale, u, {
        origin: bundle.endOfLines + phase * 0.05,
        phase,
        targetPos: home,
      });
    }
  }

  const speaking = bundle.lines.find((line) => {
    if (line.speaker !== ch.id) return false;
    const soundDuration = line.soundDuration ?? line.duration;
    return t >= line.start && t < line.start + soundDuration;
  });
  if (speaking) {
    const env = bundle.envelopes?.[speaking.sound];
    state.talk = env ? sampleEnvelope(env, t - speaking.start) : 0.65;
  }

  state.yaw += state.spin || 0;
  const breathe = 1 + Math.sin(t * 2.5 + phase) * (state.bounce ? 0.055 : 0.03);
  const talk = state.talk;
  state.scale = [
    breathe * (1 - 0.16 * talk),
    breathe * (1 + 0.34 * talk),
    breathe * (1 - 0.16 * talk),
  ];
  state.position[1] = state.hop + talk * 0.09;
  state.lean = talk * 0.22;
  state.clipTime = t - state.clipOrigin;
  return state;
}

function cameraFor(shot, poses, bundle) {
  if (!shot || shot.type === "wide" || !shot.target || !poses[shot.target]) {
    return {
      fov: FRAMING.wide.fov,
      position: [...FRAMING.wide.position],
      lookAt: [...FRAMING.wide.lookAt],
    };
  }

  if (shot.type === "two") {
    const a = poses[shot.target];
    const b = poses[shot.secondary] || a;
    const look = [
      (a.home[0] + b.home[0]) / 2,
      FRAMING.two.lookHeight,
      (a.home[2] + b.home[2]) / 2,
    ];
    return {
      fov: FRAMING.two.fov,
      position: [look[0] + 0.04, look[1] + FRAMING.two.lift, look[2] + FRAMING.two.distance],
      lookAt: look,
    };
  }

  const ch = characterById(bundle, shot.target);
  const yaw = ch.rotationY ?? 0;
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = [forward[2], 0, -forward[0]];
  const home = ch.position;
  const look = [home[0], FRAMING.close.lookHeight, home[2]];
  const d = FRAMING.close.distance;
  const s = FRAMING.close.side;
  return {
    fov: FRAMING.close.fov,
    position: [
      look[0] + forward[0] * d + right[0] * s,
      look[1] + FRAMING.close.lift,
      look[2] + forward[2] * d + right[2] * s,
    ],
    lookAt: look,
  };
}

function ballAt(bundle, t, shot) {
  const radius = 0.16;
  let x = 0.12 + Math.sin(t * 0.85) * 0.08;
  let z = 1.55;
  let bounce = Math.abs(Math.sin(t * 3.2)) * 0.14;
  if (shot?.type === "closeup" || shot?.type === "two") {
    x += 8;
  }

  for (const line of bundle.lines) {
    if (line.duringPause?.action !== "chase") continue;
    const p0 = line.start + line.duration;
    const p1 = line.blockEnd;
    if (t < p0 || t >= p1) continue;
    const u = (t - p0) / (p1 - p0);
    const k = Math.sin(u * Math.PI);
    const dog = characterById(bundle, line.duringPause.actor);
    const cat = characterById(bundle, line.duringPause.target);
    if (dog && cat) {
      x = lerp(0.05, 0.55, k);
      z = 1.45;
      bounce = Math.abs(Math.sin(u * Math.PI * 3)) * 0.2;
    }
  }

  const squash = bounce < 0.035 ? 0.72 : 1;
  return {
    position: [x, radius * squash + bounce, z],
    scale: [1 + (1 - squash) * 0.35, squash, 1 + (1 - squash) * 0.35],
  };
}

function captionAt(bundle, poses, t) {
  for (const line of bundle.lines) {
    const soundDuration = line.soundDuration ?? line.duration;
    if (t < line.start || t >= line.start + soundDuration) continue;
    if (!line.caption) continue;
    const talk = poses[line.speaker]?.talk ?? 0;
    return {
      text: line.caption,
      pop: 0.94 + 0.14 * talk,
    };
  }
  return null;
}

export function evaluate(bundle, t) {
  const shot = shotAt(bundle.shots, t);
  const poses = {};
  for (const ch of bundle.characters) poses[ch.id] = basePose(ch, bundle, t);

  const focus = focusId(bundle, t);
  if (focus && poses[focus]) {
    for (const ch of bundle.characters) {
      const pose = poses[ch.id];
      if (pose.lockYaw || ch.id === focus) continue;
      const p = poses[focus].position;
      const dx = p[0] - pose.position[0];
      const dz = p[2] - pose.position[2];
      if (Math.hypot(dx, dz) < 1e-4) continue;
      const targetYaw = Math.atan2(dx, dz);
      const base = ch.rotationY ?? 0;
      pose.yaw = base + clamp(wrapPi(targetYaw - base), -MAX_LOOK, MAX_LOOK);
    }
  }

  if (shot?.type === "closeup" && shot.target && poses[shot.target]) {
    const tx = poses[shot.target].position[0];
    for (const ch of bundle.characters) {
      if (ch.id === shot.target) continue;
      const pose = poses[ch.id];
      const sx = pose.position[0] - tx;
      const sign = sx < -0.05 ? -1 : sx > 0.05 ? 1 : pose.position[2] < 0 ? -1 : 1;
      pose.position[0] += sign * 6;
    }
  }

  return {
    t,
    shot,
    poses,
    camera: cameraFor(shot, poses, bundle),
    caption: captionAt(bundle, poses, t),
    ball: ballAt(bundle, t, shot),
  };
}

export { FRAMING };
