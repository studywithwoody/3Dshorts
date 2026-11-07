import { spawn } from "node:child_process";

/** Downscale a frame and report mean/stddev so a black or flat render fails loudly. */
export function frameStats(file) {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        file,
        "-vf",
        "scale=32:32",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks = [];
    let err = "";
    ff.stdout.on("data", (chunk) => chunks.push(chunk));
    ff.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    ff.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`無法讀取畫面 ${file}\n${err}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      let sum = 0;
      let sum2 = 0;
      for (let i = 0; i < buf.length; i++) {
        sum += buf[i];
        sum2 += buf[i] * buf[i];
      }
      const n = buf.length || 1;
      const mean = sum / n;
      const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      resolve({ mean, std, n });
    });
  });
}
