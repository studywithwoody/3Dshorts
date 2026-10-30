/**
 * Turn a script into an absolute timeline.
 * A line occupies [start, blockEnd) = performance `duration` plus `pauseAfter`.
 * Intro is a leading wide hold. Anything after the last line, up to `duration`, is the finale.
 */

export function buildTimeline(script) {
  const intro = script.intro ?? 0;
  if (intro < 0) throw new Error("intro 不能是負數");

  let cursor = intro;
  const lines = (script.lines ?? []).map((line, index) => {
    if (!line.speaker) throw new Error(`第 ${index} 句缺少 speaker`);
    const duration = Number(line.duration);
    const pauseAfter = Number(line.pauseAfter ?? 0);
    if (!(duration > 0)) throw new Error(`第 ${index} 句的 duration 必須大於 0`);
    if (pauseAfter < 0) throw new Error(`第 ${index} 句的 pauseAfter 不能是負數`);
    const start = cursor;
    const blockEnd = start + duration + pauseAfter;
    cursor = blockEnd;
    return {
      ...line,
      index,
      start,
      duration,
      pauseAfter,
      blockEnd,
    };
  });

  const endOfLines = cursor;
  const duration = script.duration ?? endOfLines;
  if (!(duration > 0)) throw new Error("duration 必須大於 0");
  if (endOfLines > duration + 1e-4) {
    throw new Error(
      `台詞總長 ${endOfLines.toFixed(3)}s 超過 duration ${duration.toFixed(3)}s`,
    );
  }

  return {
    id: script.id ?? "episode",
    title: script.title ?? script.id ?? "episode",
    fps: script.fps ?? 30,
    width: script.width ?? 1080,
    height: script.height ?? 1920,
    intro,
    lines,
    endOfLines,
    duration,
    finale: script.finale ?? null,
  };
}
