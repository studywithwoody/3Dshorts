/**
 * Every Traditional Chinese string drawn on a screen, clock, paper, or caption
 * lives here so the Noto subset and the render stay in lockstep.
 * The brand name comes from the script (`brand.name`) and is not duplicated.
 */

export const COPY = {
  time: "01:00",
  late: "凌晨",
  homeworkTitle: "數學作業",
  solveFor: "解方程式",
  equation: "x² − 5x + 6 = 0",
  halfHour: "算了半小時",
  search: "搜尋",
  formula1: "(x − 2)(x − 3) = 0",
  formula2: "Δ = b² − 4ac = 1",
  formula3: "x = (−b ± √(b² − 4ac)) / 2a",
  formula4: "∫ (2x − 5) dx = x² − 5x + C",
  formula5: "∑ α / n!  ≠ 這題",
  friend: "好友",
  me: "我",
  msg1: "這題我已經算半小時了",
  msg2: "有人會這題嗎？救命！",
  read: "已讀",
  upload: "上傳題目",
  filename: "數學作業.pdf",
  uploaded: "上傳完成",
  studentRole: "同學",
  ask: "不要直接給答案，教我怎麼想。",
  tutorRole: "AI 助教",
  hint: "先找出已知條件，再想想適合的公式。",
  known: "已知條件",
  done: "我會了",
  answer: "x = 2 或 x = 3",
  check: "完成",
};

export function allCopyText() {
  return Object.values(COPY).join("\n");
}
