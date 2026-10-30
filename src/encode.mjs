import { spawn } from "node:child_process";
import fs from "node:fs/promises";

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve(err);
      else reject(new Error(`ffmpeg 結束碼 ${code}\n${err.slice(-5000)}`));
    });
  });
}

export async function measureLoudness(file) {
  const log = await runFfmpeg([
    "-hide_banner",
    "-i",
    file,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);
  const integrated = [...log.matchAll(/^\s*I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/gm)];
  const peaks = [...log.matchAll(/^\s*Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/gm)];
  if (!integrated.length) {
    throw new Error(`無法解析響度\n${log.slice(-2500)}`);
  }
  return {
    integrated: Number(integrated[integrated.length - 1][1]),
    peakDb: peaks.length ? Number(peaks[peaks.length - 1][1]) : null,
  };
}

export async function normalizeToLufs(inWav, outWav, { target = -14, duration }) {
  const pre = outWav.replace(/\.wav$/i, ".pre.wav");
  await runFfmpeg([
    "-y",
    "-i",
    inWav,
    "-af",
    "acompressor=threshold=-18dB:ratio=2.2:attack=8:release=140:makeup=1,alimiter=limit=0.89:attack=5:release=50",
    "-ar",
    "48000",
    "-ac",
    "2",
    pre,
  ]);
  const before = await measureLoudness(pre);
  let gain = target - before.integrated;
  let capped = false;
  if (before.peakDb != null && before.peakDb + gain > -1) {
    gain = -1 - before.peakDb;
    capped = true;
  }
  const dur = duration.toFixed(3);
  await runFfmpeg([
    "-y",
    "-i",
    pre,
    "-af",
    `volume=${gain.toFixed(3)}dB,apad=whole_dur=${dur},atrim=0:${dur}`,
    "-ar",
    "48000",
    "-ac",
    "2",
    outWav,
  ]);
  await fs.unlink(pre).catch(() => {});
  const after = await measureLoudness(outWav);
  return { before, after, gain, capped, target };
}

export async function encodeVideo({ framePattern, fps, audioPath, outPath, duration }) {
  await runFfmpeg([
    "-y",
    "-framerate",
    String(fps),
    "-i",
    framePattern,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "17",
    "-preset",
    "medium",
    "-r",
    String(fps),
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    duration.toFixed(3),
    outPath,
  ]);
}

export function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type,width,height,avg_frame_rate,nb_frames,codec_name",
        "-of",
        "json",
        file,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err || `ffprobe 結束碼 ${code}`));
      else resolve(JSON.parse(out));
    });
  });
}
