import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareEpisode } from "./prepare.mjs";
import { assertShotCoverage } from "./shot-planner.mjs";
import { encodeWav } from "./audio.mjs";
import { startServer } from "./server.mjs";
import { findChrome, renderJobs, sequenceJobs } from "./render-frames.mjs";
import { encodeVideo, normalizeToLufs, probeVideo } from "./encode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`用法:
  npm run render -- scripts/cube-pets-demo.json
  npm run render -- scripts/cube-pets-demo.json --preview 0.5,1.2,3.5
  npm run render -- scripts/cube-pets-demo.json --format png

輸出: out/<id>.mp4（1080x1920、30fps）`);
}

function parseArgs(argv) {
  const opts = {
    script: null,
    preview: null,
    format: "jpeg",
    frames: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--preview") opts.preview = argv[++i].split(",").map(Number);
    else if (arg === "--format") opts.format = argv[++i];
    else if (arg === "--frames") opts.frames = Number(argv[++i]);
    else if (arg.startsWith("--")) throw new Error(`未知參數 ${arg}`);
    else if (!opts.script) opts.script = arg;
    else throw new Error(`多餘的參數 ${arg}`);
  }
  return opts;
}

function printShots(shots) {
  console.log("鏡頭：");
  for (const shot of shots) {
    const len = (shot.end - shot.start).toFixed(2);
    console.log(
      `  ${shot.start.toFixed(2)}–${shot.end.toFixed(2)}s  ${shot.type.padEnd(8)} ${shot.target ?? "group"}  (${len}s)`,
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.script) {
    usage();
    process.exit(opts.help ? 0 : 1);
  }
  if (opts.format !== "jpeg" && opts.format !== "png") {
    throw new Error("--format 只能是 jpeg 或 png");
  }

  const scriptPath = path.resolve(opts.script);
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const { bundle, audio } = prepareEpisode(script);
  assertShotCoverage(bundle.shots, bundle.duration);
  printShots(bundle.shots);

  const outDir = path.join(root, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const rawWav = path.join(outDir, `${bundle.id}.raw.wav`);
  fs.writeFileSync(rawWav, encodeWav(audio.samples, audio.sampleRate));
  console.log(`已合成音訊 ${rawWav}（${audio.duration.toFixed(2)}s）`);

  const chromePath = findChrome();
  console.log(`Chrome: ${chromePath}`);
  const server = await startServer({ root, bundle });
  const pageUrl = `${server.url}/src/stage/index.html?format=${opts.format}`;
  console.log(`舞台 ${pageUrl}`);

  try {
    if (opts.preview) {
      const previewDir = path.join(outDir, "preview");
      const jobs = opts.preview.map((time) => ({
        time,
        format: "image/jpeg",
        file: path.join(previewDir, `t_${time.toFixed(3)}.jpg`),
      }));
      await renderJobs({
        url: pageUrl,
        width: bundle.width,
        height: bundle.height,
        jobs,
        chromePath,
      });
      console.log(`預覽完成：${previewDir}`);
      return;
    }

    const framesDir = path.join(outDir, "frames");
    fs.rmSync(framesDir, { recursive: true, force: true });
    const { jobs, ext, count } = sequenceJobs({
      framesDir,
      fps: bundle.fps,
      duration: bundle.duration,
      format: opts.format,
    });
    const selected = opts.frames ? jobs.slice(0, opts.frames) : jobs;
    console.log(`開始逐幀渲染 ${selected.length}/${count} 張 ${bundle.width}x${bundle.height}`);
    const started = Date.now();
    await renderJobs({
      url: pageUrl,
      width: bundle.width,
      height: bundle.height,
      jobs: selected,
      chromePath,
    });
    console.log(`畫面完成，耗時 ${((Date.now() - started) / 1000).toFixed(1)}s`);

    if (selected.length !== count) {
      console.log("未渲染完整片長，略過編碼。");
      return;
    }

    const normWav = path.join(outDir, `${bundle.id}.wav`);
    const loudness = await normalizeToLufs(rawWav, normWav, {
      target: -14,
      duration: bundle.duration,
    });
    console.log(
      `響度 ${loudness.after.integrated.toFixed(2)} LUFS（峰值 ${loudness.after.peakDb ?? "?"} dBFS，增益 ${loudness.gain.toFixed(2)} dB${loudness.capped ? "，已受峰值限制" : ""}）`,
    );

    const outFile = path.join(outDir, `${bundle.id}.mp4`);
    await encodeVideo({
      framePattern: path.join(framesDir, `frame_%04d.${ext}`),
      fps: bundle.fps,
      audioPath: normWav,
      outPath: outFile,
      duration: bundle.duration,
    });
    const probe = await probeVideo(outFile);
    console.log(`輸出 ${outFile}`);
    console.log(JSON.stringify(probe, null, 2));
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
