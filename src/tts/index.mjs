import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { synthesizeElevenLabs } from "./elevenlabs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EDGE_PY = path.join(root, "src/tts/edge_render.py");

/**
 * Pluggable speech synthesis.
 * `provider` is "edge" (default, no API key) or "elevenlabs".
 * Edge results are cached as mp3 + json under cacheDir, keyed by voice/rate/text.
 */
export async function synthesizeSpeech({
  provider = "edge",
  voice,
  text,
  rate = "+0%",
  cacheDir,
}) {
  if (!voice) throw new Error("TTS 缺少 voice");
  if (!text) throw new Error("TTS 缺少 text");
  if (provider === "elevenlabs") {
    return synthesizeElevenLabs({ text, voice, rate });
  }
  if (provider !== "edge") {
    throw new Error(`未知的 TTS provider「${provider}」。可用：edge、elevenlabs`);
  }
  return synthesizeEdge({ voice, text, rate, cacheDir });
}

async function synthesizeEdge({ voice, text, rate, cacheDir }) {
  const dir = cacheDir
    ? path.resolve(root, cacheDir)
    : path.join(root, "cache/tts");
  fs.mkdirSync(dir, { recursive: true });
  const id = crypto
    .createHash("sha256")
    .update(JSON.stringify({ provider: "edge", voice, rate, text }))
    .digest("hex")
    .slice(0, 24);
  const mp3 = path.join(dir, `${id}.mp3`);
  const metaPath = path.join(dir, `${id}.json`);

  if (!fs.existsSync(mp3) || !fs.existsSync(metaPath)) {
    const rates = [...new Set([rate, "+0%", "-4%", "+6%", "-8%", "+12%"])];
    let last = "";
    let saved = false;
    for (const tryRate of rates) {
      for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
        const result = spawnSync(
          "python3",
          [EDGE_PY, "--text", text, "--voice", voice, `--rate=${tryRate}`, "--mp3", mp3, "--meta", metaPath],
          { encoding: "utf8" },
        );
        if (result.status === 0 && fs.existsSync(mp3) && fs.existsSync(metaPath)) {
          saved = true;
          break;
        }
        last = (result.stderr || result.stdout || "edge-tts 失敗").trim();
        fs.rmSync(mp3, { force: true });
        fs.rmSync(metaPath, { force: true });
        await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
      }
      if (saved) break;
    }
    if (!saved) throw new Error(`edge-tts 失敗（${voice}）：${last}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const decoded = decodeMp3(mp3);
  const lastWord = meta.words[meta.words.length - 1]?.end ?? 0;
  const samples = trimTail(decoded, 44100, lastWord);
  fadeTail(samples, 44100);
  normalizePeak(samples, 0.9);
  return {
    provider: "edge",
    voice,
    text,
    rate,
    words: meta.words,
    sentences: meta.sentences ?? [],
    samples,
    sampleRate: 44100,
    duration: samples.length / 44100,
    cacheId: id,
  };
}

function decodeMp3(file) {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ac", "1", "-ar", "44100", "-f", "f32le", "pipe:1"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`無法解碼 ${file}：${result.stderr?.toString() || result.status}`);
  }
  const buf = result.stdout;
  const samples = new Float32Array(Math.floor(buf.length / 4));
  for (let i = 0; i < samples.length; i++) samples[i] = buf.readFloatLE(i * 4);
  return samples;
}

function trimTail(samples, sampleRate, lastWordEnd) {
  const guard = Math.min(samples.length, Math.floor((lastWordEnd + 0.2) * sampleRate));
  let last = guard;
  for (let i = samples.length - 1; i > guard; i--) {
    if (Math.abs(samples[i]) > 0.02) {
      last = i;
      break;
    }
  }
  const end = Math.min(samples.length, last + Math.floor(0.06 * sampleRate));
  return samples.slice(0, Math.max(end, guard));
}

function fadeTail(samples, sampleRate) {
  const n = Math.min(samples.length, Math.floor(sampleRate * 0.02));
  for (let i = 0; i < n; i++) samples[samples.length - 1 - i] *= i / n;
}

function normalizePeak(samples, peakTarget) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 1e-6) return;
  const gain = peakTarget / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}
