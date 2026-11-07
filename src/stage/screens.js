import { COPY } from "/src/screen-copy.mjs";

const FONT = '"Noto Sans TC", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function fillBlock(ctx, text, x, y, opt = {}) {
  ctx.save();
  ctx.fillStyle = opt.color || "#f4f7fb";
  ctx.font = `${opt.weight || 700} ${opt.size || 48}px ${FONT}`;
  ctx.textAlign = opt.align || "left";
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, text, opt.maxWidth || 800);
  const gap = (opt.size || 48) * 1.25;
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * gap));
  ctx.restore();
  return lines.length;
}

function fillText(ctx, text, x, y, opt = {}) {
  ctx.save();
  ctx.fillStyle = opt.color || "#f4f7fb";
  ctx.font = `${opt.weight || 700} ${opt.size || 48}px ${FONT}`;
  ctx.textAlign = opt.align || "left";
  ctx.textBaseline = opt.baseline || "top";
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawLaptop(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  const mode = state.mode;
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, state.brand || "AI 學習平台", 36, 36, { size: 36, color: "#8eb4c9" });
  fillText(ctx, COPY.time, w - 36, 40, { size: 36, align: "right", color: "#d5e4ef" });

  if (mode === "search") {
    roundRect(ctx, 32, 110, w - 64, 150, 18);
    ctx.fillStyle = "#243140";
    ctx.fill();
    fillText(ctx, COPY.search, 52, 128, { size: 28, color: "#8eb4c9" });
    fillBlock(ctx, COPY.equation, 52, 172, { size: 40, color: "#f7fbff", maxWidth: w - 110 });
    const cards = [COPY.formula1, COPY.formula2, COPY.formula3, COPY.formula4, COPY.formula5];
    cards.forEach((line, i) => {
      const y = 290 + i * 175;
      roundRect(ctx, 32, y, w - 64, 158, 16);
      ctx.fillStyle = i % 2 ? "#1c2836" : "#243246";
      ctx.fill();
      fillBlock(ctx, line, 52, y + 36, { size: 36, color: "#e7eef6", maxWidth: w - 120 });
    });
    return;
  }

  if (mode === "upload") {
    fillText(ctx, COPY.upload, 48, 180, { size: 64, color: "#f4fbff" });
    roundRect(ctx, 40, 300, w - 80, 180, 18);
    ctx.fillStyle = "#243246";
    ctx.fill();
    fillText(ctx, COPY.filename, 64, 340, { size: 40, color: "#ffffff" });
    const progress = state.progress ?? 0;
    roundRect(ctx, 64, 410, w - 128, 28, 12);
    ctx.fillStyle = "#121820";
    ctx.fill();
    roundRect(ctx, 64, 410, Math.max(16, (w - 128) * progress), 28, 12);
    ctx.fillStyle = "#f6c453";
    ctx.fill();
    fillText(ctx, progress > 0.97 ? COPY.uploaded : COPY.upload, 48, 530, {
      size: 40,
      color: "#b7c9d6",
    });
    return;
  }

  if (mode === "tutor") {
    bubble(ctx, 36, 140, w - 72, 280, "#2a3b4e", COPY.studentRole, COPY.ask);
    bubble(ctx, 36, 460, w - 72, 320, "#204538", COPY.tutorRole, COPY.hint);
    return;
  }

  if (mode === "solved") {
    fillText(ctx, COPY.done, 48, 180, { size: 80, color: "#f6c453" });
    fillText(ctx, COPY.known, 48, 310, { size: 36, color: "#9fb4c4" });
    fillBlock(ctx, COPY.equation, 48, 370, { size: 42, color: "#ffffff", maxWidth: w - 100 });
    fillBlock(ctx, COPY.formula1, 48, 480, { size: 40, color: "#d5e7f5", maxWidth: w - 100 });
    fillText(ctx, COPY.answer, 48, 620, { size: 52, color: "#b6f3c8" });
    fillText(ctx, COPY.check, 48, 720, { size: 40, color: "#8fd7a8" });
    return;
  }

  fillText(ctx, COPY.homeworkTitle, 48, 220, { size: 48, color: "#6e8192" });
  fillBlock(ctx, COPY.equation, 48, 320, { size: 40, color: "#8ea0b0", maxWidth: w - 100 });
}

function bubble(ctx, x, y, w, h, color, role, text) {
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = color;
  ctx.fill();
  fillText(ctx, role, x + 24, y + 16, { size: 26, color: "#f6c453" });
  fillBlock(ctx, text, x + 24, y + 64, { size: 36, color: "#f7fbff", maxWidth: w - 48 });
}

export function drawPhone(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, COPY.late, 28, 36, { size: 28, color: "#9fb0bf" });
  fillText(ctx, COPY.time, w - 28, 28, { size: 40, align: "right", color: "#f4f7fb" });
  if (state.mode !== "chat") {
    fillText(ctx, COPY.time, w / 2, h * 0.38, {
      size: 72,
      align: "center",
      color: "#d5e0ea",
    });
    fillText(ctx, COPY.late, w / 2, h * 0.38 + 90, {
      size: 32,
      align: "center",
      color: "#8ea0b0",
    });
    return;
  }
  fillText(ctx, COPY.friend, 28, 110, { size: 40, color: "#f7fbff" });
  const flash = state.flash ? "#ffe7a8" : "#2f6f4e";
  message(ctx, 24, 190, w - 48, 150, COPY.me, COPY.msg1, "#245c44");
  message(ctx, 24, 360, w - 48, 170, COPY.me, COPY.msg2, flash);
  fillText(ctx, COPY.read, w - 36, 550, { size: 36, align: "right", color: "#8eb4c9" });
}

function message(ctx, x, y, w, h, role, text, color) {
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = color;
  ctx.fill();
  fillText(ctx, role, x + 20, y + 16, { size: 24, color: "#d8ffe8" });
  fillText(ctx, text, x + 20, y + 58, { size: 32, color: "#ffffff" });
}

export function drawPaper(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f3efe4";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d7c7a4";
  ctx.lineWidth = 3;
  for (let y = 120; y < h; y += 56) {
    ctx.beginPath();
    ctx.moveTo(36, y);
    ctx.lineTo(w - 36, y);
    ctx.stroke();
  }
  fillText(ctx, COPY.homeworkTitle, 48, 48, { size: 52, color: "#3e3428" });
  fillText(ctx, `${COPY.late} ${COPY.time}`, 48, 118, { size: 36, color: "#8a5a3a" });
  if (state.mode === "solved") {
    fillText(ctx, COPY.done, 48, 220, { size: 72, color: "#2f7d45" });
    fillText(ctx, COPY.answer, 48, 340, { size: 48, color: "#243028" });
    fillText(ctx, COPY.check, 48, 430, { size: 40, color: "#2f7d45" });
    return;
  }
  fillText(ctx, COPY.solveFor, 48, 210, { size: 44, color: "#3e3428" });
  fillText(ctx, COPY.equation, 48, 300, { size: 46, color: "#1d2430" });
  fillText(ctx, COPY.halfHour, 48, 390, { size: 36, color: "#8a5a3a" });
}

export function drawClock(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const c = w / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 8, 0, Math.PI * 2);
  ctx.fillStyle = "#1b140e";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#f6c453";
  ctx.stroke();
  ctx.save();
  ctx.translate(c, c);
  ctx.strokeStyle = "#f4f7fb";
  ctx.lineCap = "round";
  const hand = (angle, length, width) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();
    ctx.restore();
  };
  hand(-Math.PI / 2, c * 0.46, 8);
  hand(-Math.PI / 2 + Math.PI / 6, c * 0.3, 14);
  ctx.restore();
  fillText(ctx, COPY.time, c, h * 0.72, {
    size: 72,
    align: "center",
    color: "#f6c453",
  });
}

export function drawAi(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, 28);
  ctx.fillStyle = "#16352c";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(78, 78, 36, 0, Math.PI * 2);
  ctx.fillStyle = "#f6c453";
  ctx.fill();
  ctx.fillStyle = "#16352c";
  ctx.beginPath();
  ctx.arc(64, 74, 6, 0, Math.PI * 2);
  ctx.arc(92, 74, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#16352c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(78, 86, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  fillText(ctx, state.brand || COPY.tutorRole, 130, 40, { size: 34, color: "#f6c453" });
  fillBlock(ctx, COPY.hint, 36, 150, { size: 40, color: "#f7fbff", maxWidth: w - 72 });
}
