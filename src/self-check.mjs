import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareEpisode } from "./prepare.mjs";
import { assertShotCoverage } from "./shot-planner.mjs";
import { evaluate, sampleEnvelope } from "./playback.mjs";
import { evaluate as evaluateStudy } from "./study-playback.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/cube-pets-demo.json"), "utf8"),
);
const { bundle, audio, clips } = await prepareEpisode(script);

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(Math.abs(bundle.duration - 10) < 1e-6, "示範片長應為 10 秒");
assert(bundle.width === 1080 && bundle.height === 1920, "解析度應為 1080x1920");
assert(bundle.fps === 30, "fps 應為 30");
assertShotCoverage(bundle.shots, bundle.duration);

const types = new Set(bundle.shots.map((shot) => shot.type));
assert(types.has("wide") && types.has("closeup"), "必須同時有遠景與特寫");

for (const name of ["woof", "meow", "cheep", "oink"]) {
  const env = clips[name].envelope.values;
  const peaks = env.filter((v, i) => i > 0 && i < env.length - 1 && v > 0.55 && v >= env[i - 1] && v > env[i + 1]).length;
  assert(peaks >= 1, `${name} 包絡沒有峰值`);
  assert(clips[name].duration > 0.3 && clips[name].duration < 1.05, `${name} 時長異常`);
}

const dogLine = bundle.lines.find((line) => line.speaker === "dog");
let maxTalk = 0;
for (let step = 0; step < 12; step++) {
  const t = dogLine.start + (dogLine.soundDuration * step) / 11;
  maxTalk = Math.max(maxTalk, sampleEnvelope(bundle.envelopes.woof, t - dogLine.start));
}
assert(maxTalk > 0.8, `狗叫包絡峰值過低 ${maxTalk}`);

const midBark = dogLine.start + 0.08;
const barkFrame = evaluate(bundle, midBark);
assert(barkFrame.caption?.text === "Woof!", "狗叫時應出現 Woof!");
assert(barkFrame.shot.type === "closeup" && barkFrame.shot.target === "dog", "狗叫應是特寫");
assert(barkFrame.poses.dog.talk > 0.25, "狗叫當下身體應有振幅反應");
assert(Math.abs(barkFrame.poses.cat.position[0]) > 3, "特寫時其他角色應讓出畫面");

const chaseLine = bundle.lines.find((line) => line.duringPause?.action === "chase");
const tChase = chaseLine.start + chaseLine.duration + (chaseLine.pauseAfter * 0.45);
const chase = evaluate(bundle, tChase);
assert(chase.shot.type === "wide", "追逐段應是遠景");
assert(chase.poses.dog.clip === "run", "追逐時狗應播跑步");
assert(chase.poses.dog.position[2] > chase.poses.dog.home[2] + 0.1, "狗應往前跑");

const finale = evaluate(bundle, bundle.endOfLines + 0.4);
assert(finale.shot.type === "wide", "結尾應是遠景");
assert(finale.poses.cat.clip === "dance", "結尾大家應跳舞");
assert(finale.caption == null, "結尾不該有字幕");

for (let i = 0; i <= 40; i++) {
  const frame = evaluate(bundle, (bundle.duration * i) / 40);
  for (const value of [...frame.camera.position, ...frame.camera.lookAt, frame.camera.fov]) {
    assert(Number.isFinite(value), `t=${frame.t} 鏡頭數值不是有限數`);
  }
}

let peak = 0;
for (let i = 0; i < audio.samples.length; i++) peak = Math.max(peak, Math.abs(audio.samples[i]));
assert(peak > 0.2 && peak <= 1, `混音峰值異常 ${peak}`);
assert(audio.samples.length === Math.floor(audio.sampleRate * bundle.duration), "混音長度不符");

const silent = bundle.lines.some((line, index) => {
  const next = bundle.lines[index + 1];
  if (!next) return false;
  return next.start < line.start + line.soundDuration - 1e-3;
});
assert(!silent, "音效不應重疊");

const studyScript = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/ai-tutor-ad.json"), "utf8"),
);
const study = await prepareEpisode(studyScript);
assert(Math.abs(study.bundle.duration - 30) < 0.05, `助教片長應約 30 秒，實際 ${study.bundle.duration}`);
assert(study.bundle.scene === "study", "助教片場景應為 study");
assert(study.bundle.brand?.name === "AI 學習平台", "品牌名稱應來自腳本");
assertShotCoverage(study.bundle.shots, study.bundle.duration);
assert(study.bundle.shots.some((shot) => shot.type === "logo"), "結尾應有 logo 鏡");
const spoken = study.bundle.lines.find((line) => line.words?.length);
const midWord = spoken.words[Math.floor(spoken.words.length / 2)];
const talkAt = spoken.start + (midWord.start + midWord.end) / 2;
const talking = evaluateStudy(study.bundle, talkAt);
assert(talking.poses.student.mouth > 0.2, `說話中嘴型應張開 ${talking.poses.student.mouth}`);
assert(/[\u4e00-\u9fff]/.test(talking.caption?.text ?? ""), "字幕應有繁體中文");
assert(talking.overlay == null, "台詞中不該蓋上結尾 logo");
const logoFrame = evaluateStudy(study.bundle, study.bundle.duration - 0.4);
assert(logoFrame.overlay?.name === "AI 學習平台", "結尾應畫出品牌名稱");

console.log("self-check ok");
console.log(
  bundle.shots
    .map(
      (shot) =>
        `${shot.start.toFixed(2)}-${shot.end.toFixed(2)} ${shot.type} ${shot.target ?? "group"}`,
    )
    .join("\n"),
);
