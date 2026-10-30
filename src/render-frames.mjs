import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { frameStats } from "./frame-stats.mjs";

const BASE_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  "--mute-audio",
  "--force-color-profile=srgb",
  "--disable-features=Translate,IsolateOrigins,site-per-process",
];

const GL_VARIANTS = [
  [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
  ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle"],
  ["--enable-webgl", "--ignore-gpu-blocklist"],
];

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of candidates) {
    if (candidate.startsWith("/")) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    const found = spawnSync("bash", ["-lc", `command -v ${candidate}`], {
      encoding: "utf8",
    });
    const out = (found.stdout || "").trim();
    if (found.status === 0 && out) return out;
  }
  throw new Error("找不到 Chrome/Chromium。請安裝並設定環境變數 CHROME_PATH。");
}

function pad(index) {
  return String(index).padStart(4, "0");
}

async function launchPage({ chromePath, url, width, height, glArgs }) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    timeout: 60000,
    protocolTimeout: 300000,
    args: [...BASE_ARGS, ...glArgs, `--window-size=${width},${height}`],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning" || type === "log") {
      console.log(`[page:${type}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.error(`[pageerror] ${err.message}`);
  });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForFunction(() => window.__READY === true || window.__ERROR, {
    timeout: 90000,
  });
  const error = await page.evaluate(() => window.__ERROR || null);
  if (error) {
    await browser.close();
    throw new Error(`舞台初始化失敗：${error}`);
  }
  return { browser, page };
}

async function grab(page, time, format) {
  const dataUrl = await page.evaluate(async (t, fmt) => {
    window.__seek(t);
    return window.__capture(fmt);
  }, time, format);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("截圖回傳不是 data URL");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

/**
 * Render absolute times (seconds) to files. `jobs` is [{ time, file, format }].
 * Retries WebGL backends if the first frame is blank.
 */
export async function renderJobs({ url, width, height, jobs, chromePath }) {
  let lastError = null;
  for (const glArgs of GL_VARIANTS) {
    console.log(`啟動 Chrome（${glArgs.join(" ")}）`);
    let browser;
    try {
      const launched = await launchPage({
        chromePath,
        url,
        width,
        height,
        glArgs,
      });
      browser = launched.browser;
      const page = launched.page;
      const first = jobs[0];
      const buf = await grab(page, first.time, first.format);
      fs.mkdirSync(path.dirname(first.file), { recursive: true });
      fs.writeFileSync(first.file, buf);
      const stats = await frameStats(first.file);
      console.log(
        `首幀檢查 ${path.basename(first.file)} mean=${stats.mean.toFixed(1)} std=${stats.std.toFixed(1)}`,
      );
      if (stats.std < 8 || stats.mean < 12) {
        throw new Error(
          `首幀近乎空白（mean ${stats.mean.toFixed(1)} std ${stats.std.toFixed(1)}）`,
        );
      }
      for (let i = 1; i < jobs.length; i++) {
        const job = jobs[i];
        const frame = await grab(page, job.time, job.format);
        fs.mkdirSync(path.dirname(job.file), { recursive: true });
        fs.writeFileSync(job.file, frame);
        if (i % 15 === 0 || i === jobs.length - 1) {
          console.log(`畫面 ${i + 1}/${jobs.length}  t=${job.time.toFixed(3)}s`);
        }
      }
      await browser.close();
      return;
    } catch (err) {
      lastError = err;
      console.error(`這個 WebGL 設定失敗：${err.message}`);
      if (browser) await browser.close().catch(() => {});
    }
  }
  throw lastError ?? new Error("無法啟動帶 WebGL 的 Chrome");
}

export function sequenceJobs({ framesDir, fps, duration, format }) {
  const ext = format === "png" ? "png" : "jpg";
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const count = Math.round(duration * fps);
  const jobs = [];
  for (let i = 0; i < count; i++) {
    jobs.push({
      index: i,
      time: i / fps,
      format: mime,
      file: path.join(framesDir, `frame_${pad(i)}.${ext}`),
    });
  }
  return { jobs, ext, count };
}
