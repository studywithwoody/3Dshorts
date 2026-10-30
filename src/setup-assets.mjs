/**
 * Re-download Kenney Cube Pets (CC0) if the vendored GLBs are missing.
 * A normal clone already contains the models, the shared colormap and License.txt.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const needed = [
  "assets/models/animal-dog.glb",
  "assets/models/animal-cat.glb",
  "assets/models/animal-chick.glb",
  "assets/models/animal-pig.glb",
  "assets/models/Textures/colormap.png",
  "assets/licenses/Kenney-Cube-Pets-CC0.txt",
];

const missing = needed.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (!missing.length) {
  console.log("Cube Pets 素材已在倉庫裡，不必重新下載。");
  process.exit(0);
}

console.log("缺少：\n  " + missing.join("\n  "));
const page = spawnSync(
  "curl",
  [
    "-fsSL",
    "-A",
    "Mozilla/5.0",
    "-H",
    "Accept: application/json",
    "-H",
    "Referer: https://kenney.nl/assets/cube-pets",
    "https://kenney.nl/download-link/6173736574732f637562652d70657473",
  ],
  { encoding: "utf8" },
);
if (page.status !== 0) {
  console.error(page.stderr);
  throw new Error("無法取得 Kenney 下載連結");
}
const signed = JSON.parse(page.stdout).url;
if (!signed) throw new Error("Kenney 沒有回傳下載網址");

const zipPath = path.join(root, "out", "kenney_cube-pets.zip");
fs.mkdirSync(path.dirname(zipPath), { recursive: true });
const download = spawnSync(
  "curl",
  ["-fL", "--retry", "3", "-A", "Mozilla/5.0", "-o", zipPath, signed],
  { stdio: "inherit" },
);
if (download.status !== 0) throw new Error("下載 zip 失敗");

const extractDir = path.join(root, "out", "kenney_cube-pets");
fs.rmSync(extractDir, { recursive: true, force: true });
const unzip = spawnSync("unzip", ["-q", zipPath, "-d", extractDir], { stdio: "inherit" });
if (unzip.status !== 0) throw new Error("解壓縮失敗");

const glbDir = path.join(extractDir, "Models", "GLB format");
fs.mkdirSync(path.join(root, "assets/models/Textures"), { recursive: true });
fs.mkdirSync(path.join(root, "assets/licenses"), { recursive: true });
for (const name of ["animal-dog", "animal-cat", "animal-chick", "animal-pig"]) {
  fs.copyFileSync(
    path.join(glbDir, `${name}.glb`),
    path.join(root, "assets/models", `${name}.glb`),
  );
}
fs.copyFileSync(
  path.join(glbDir, "Textures", "colormap.png"),
  path.join(root, "assets/models/Textures/colormap.png"),
);
fs.copyFileSync(
  path.join(extractDir, "License.txt"),
  path.join(root, "assets/licenses/Kenney-Cube-Pets-CC0.txt"),
);
console.log("已更新 assets/models 與授權檔。");
