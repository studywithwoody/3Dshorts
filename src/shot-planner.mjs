/**
 * Rule-based shot planner.
 * Each line becomes a close-up (or an explicit `shot`) covering the performance.
 * A pause of at least ~0.95s becomes its own wide (or two-shot). Silences shorter
 * than 0.8s are absorbed so we never cut to a blink-length shot.
 * The intro and the finale tail are wide group shots.
 * Every cut is a pure function of the script — no randomness.
 */

const MIN_SHOT = 0.8;
const WIDE_PAUSE = 0.95;

export function planShots(timeline) {
  if (timeline.planner === "cycle") return planCycleShots(timeline);
  const shots = [];

  if (timeline.intro > 0.02) {
    shots.push({
      start: 0,
      end: timeline.intro,
      type: "wide",
      target: null,
      secondary: null,
    });
  }

  const lines = timeline.lines;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const secondary = line.secondary || next?.speaker || null;
    const block = line.blockEnd - line.start;

    let cuLen = line.shotHold ?? line.duration;
    if (cuLen < 1 && block >= 1) cuLen = Math.min(1, block);
    cuLen = Math.min(Math.max(cuLen, Math.min(MIN_SHOT, block)), block);

    let cuEnd = line.start + cuLen;
    const remain = line.blockEnd - cuEnd;
    if (remain > 1e-4 && remain < MIN_SHOT) cuEnd = line.blockEnd;

    shots.push({
      start: line.start,
      end: cuEnd,
      type: line.shot || "closeup",
      target: line.speaker,
      secondary,
    });

    if (line.blockEnd - cuEnd >= MIN_SHOT - 1e-4) {
      const gap = line.blockEnd - cuEnd;
      const pauseType = line.pauseShot || (gap >= WIDE_PAUSE ? "wide" : "two");
      const pauseTarget =
        line.duringPause?.actor && line.duringPause.actor !== "*"
          ? line.duringPause.actor
          : line.speaker;
      shots.push({
        start: cuEnd,
        end: line.blockEnd,
        type: pauseType,
        target: pauseTarget,
        secondary,
      });
    }
  }

  const covered = shots.length ? shots[shots.length - 1].end : 0;
  const tail = timeline.duration - covered;
  if (tail >= MIN_SHOT - 1e-4) {
    shots.push({
      start: covered,
      end: timeline.duration,
      type: "wide",
      target: null,
      secondary: null,
    });
  } else if (tail > 1e-4 && shots.length) {
    shots[shots.length - 1].end = timeline.duration;
  }

  return shots;
}

function planCycleShots(timeline) {
  const shots = [];
  if (timeline.intro > 0.02) {
    shots.push({
      start: 0,
      end: timeline.intro,
      type: "wide",
      focus: "room",
      target: null,
      secondary: null,
    });
  }

  for (const line of timeline.lines) {
    const pattern =
      line.shotCycle?.length > 0
        ? line.shotCycle
        : [
            { type: "wide", focus: "room" },
            { type: "closeup", focus: "student" },
            { type: "ots", focus: line.focus || "laptop" },
          ];
    const start = line.start;
    const end = line.blockEnd;
    const len = end - start;
    let count = pattern.length;
    while (len / count > 3) count += 1;
    while (count > 1 && len / count < MIN_SHOT) count -= 1;
    const piece = len / count;
    if (piece > 3.001 || piece < MIN_SHOT - 0.02) {
      throw new Error(
        `「${line.text || line.speaker}」這一段 ${len.toFixed(2)}s 切不成 0.8–3 秒的鏡頭`,
      );
    }
    let cursor = start;
    for (let i = 0; i < count; i++) {
      const spec = pattern[i % pattern.length];
      const shotEnd = i === count - 1 ? end : start + (len * (i + 1)) / count;
      const type = typeof spec === "string" ? spec : spec.type;
      const focus = typeof spec === "string" ? line.focus || null : spec.focus || null;
      shots.push({
        start: cursor,
        end: shotEnd,
        type,
        focus,
        target: line.speaker,
        secondary: null,
      });
      cursor = shotEnd;
    }
  }

  const covered = shots.length ? shots[shots.length - 1].end : 0;
  const tail = timeline.duration - covered;
  if (tail >= MIN_SHOT - 1e-4) {
    shots.push({
      start: covered,
      end: timeline.duration,
      type: "wide",
      focus: "room",
      target: null,
      secondary: null,
    });
  } else if (tail > 1e-4 && shots.length) {
    shots[shots.length - 1].end = timeline.duration;
  }
  return shots;
}

export function assertShotCoverage(shots, duration) {
  if (!shots.length) throw new Error("鏡頭表是空的");
  let cursor = 0;
  for (const shot of shots) {
    if (shot.end <= shot.start) {
      throw new Error(`鏡頭長度無效：${JSON.stringify(shot)}`);
    }
    if (Math.abs(shot.start - cursor) > 1e-4) {
      throw new Error(
        `鏡頭沒有接上：預期 ${cursor.toFixed(4)}，實際 ${shot.start.toFixed(4)}`,
      );
    }
    const len = shot.end - shot.start;
    if (len < MIN_SHOT - 0.02 || len > 3.02) {
      throw new Error(
        `鏡頭 ${shot.type}/${shot.target ?? "-"} 長度 ${len.toFixed(3)}s 不在 0.8–3.0s`,
      );
    }
    cursor = shot.end;
  }
  if (Math.abs(cursor - duration) > 1e-4) {
    throw new Error(
      `鏡頭總長 ${cursor.toFixed(4)}s 不等於 duration ${duration.toFixed(4)}s`,
    );
  }
}
