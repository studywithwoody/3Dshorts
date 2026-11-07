/**
 * Stylized animal onomatopoeia, synthesized in-process (no sample libraries).
 * Waveforms are fully deterministic: integer-seeded noise, fixed envelopes.
 * The amplitude envelope of each call is what the stage uses to squash,
 * stretch and bob the speaking pet.
 */

const SAMPLE_RATE = 44100;

const LIBRARY = {
  woof: synthWoof,
  meow: synthMeow,
  cheep: synthCheep,
  oink: synthOink,
  ping: synthPing,
  slam: synthSlam,
};

export function listSounds() {
  return Object.keys(LIBRARY);
}

export function synthesize(name) {
  const fn = LIBRARY[name];
  if (!fn) {
    throw new Error(
      `未知音效「${name}」。內建：${Object.keys(LIBRARY).join(", ")}`,
    );
  }
  const clip = fn(SAMPLE_RATE);
  fadeEdges(clip.samples, SAMPLE_RATE);
  normalize(clip.samples, 0.92);
  return {
    name,
    sampleRate: SAMPLE_RATE,
    samples: clip.samples,
    duration: clip.samples.length / SAMPLE_RATE,
    envelope: envelopeOf(clip.samples, SAMPLE_RATE),
  };
}

function synthWoof(sr) {
  const dur = 0.64;
  const n = Math.floor(sr * dur);
  const noise = lowpass(makeNoise(n, 0xd06), 980, sr);
  const out = new Float32Array(n);
  const bursts = [0.012, 0.3];
  for (const b of bursts) {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr - b;
      if (t < 0 || t > 0.24) continue;
      const env = Math.exp(-t * 13) * (1 - Math.exp(-t * 90));
      const pitch = 155 * Math.exp(-t * 5.5);
      phase += (2 * Math.PI * pitch) / sr;
      const tone = Math.sin(phase);
      out[i] += (noise[i] * 0.85 + tone * 0.7) * env;
    }
  }
  return { samples: lowpass(out, 2200, sr) };
}

function synthMeow(sr) {
  const dur = 0.74;
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const u = t / dur;
    const f =
      (u < 0.32
        ? 480 + (860 - 480) * (u / 0.32)
        : 860 + (360 - 860) * ((u - 0.32) / 0.68)) *
      (1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t));
    phase += (2 * Math.PI * f) / sr;
    const amp = Math.sin(Math.PI * Math.min(1, u / 0.97)) ** 0.75;
    const s =
      Math.sin(phase) +
      Math.sin(2 * phase) * 0.42 +
      Math.sin(3 * phase) * 0.16;
    out[i] = s * amp;
  }
  return { samples: lowpass(out, 2800, sr) };
}

function synthCheep(sr) {
  const dur = 0.5;
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const chirps = [0.02, 0.18, 0.34];
  for (const c of chirps) {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr - c;
      if (t < 0 || t > 0.12) continue;
      const f = 2700 - t * 7800;
      phase += (2 * Math.PI * f) / sr;
      const env = Math.sin(Math.PI * (t / 0.12)) ** 0.55;
      out[i] += Math.sin(phase) * env;
    }
  }
  return { samples: out };
}

function synthOink(sr) {
  const dur = 0.56;
  const n = Math.floor(sr * dur);
  const noise = lowpass(makeNoise(n, 0x0916), 700, sr);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const u = t / dur;
    const f = 230 - 120 * u;
    phase += (2 * Math.PI * f) / sr;
    const nasal = 0.62 + 0.38 * Math.sin(2 * Math.PI * 30 * t);
    const amp = Math.sin(Math.PI * Math.min(1, u / 0.96)) ** 0.65;
    const wrapped = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const saw = wrapped / Math.PI - 1;
    out[i] =
      (Math.sin(phase) * 0.62 + saw * 0.28 + noise[i] * 0.38) * nasal * amp;
  }
  return { samples: lowpass(out, 1800, sr) };
}

function synthPing(sr) {
  const dur = 0.42;
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const notes = [
    { t: 0.01, f: 1046.5, d: 0.16 },
    { t: 0.14, f: 1568, d: 0.2 },
  ];
  for (const note of notes) {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr - note.t;
      if (t < 0 || t > note.d) continue;
      phase += (2 * Math.PI * note.f) / sr;
      const env = Math.sin(Math.PI * Math.min(1, t / note.d)) ** 0.55 * Math.exp(-t * 6.5);
      out[i] += (Math.sin(phase) + Math.sin(phase * 2) * 0.16) * env;
    }
  }
  return { samples: out };
}

function synthSlam(sr) {
  const dur = 0.48;
  const n = Math.floor(sr * dur);
  const noise = lowpass(makeNoise(n, 0x51a1), 900, sr);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += (2 * Math.PI * (130 * Math.exp(-t * 8) + 48)) / sr;
    const env = Math.exp(-t * 8.5) * (1 - Math.exp(-t * 90));
    out[i] = (Math.sin(phase) * 0.95 + noise[i] * 0.8) * env;
  }
  return { samples: lowpass(out, 2400, sr) };
}

function synthMusic(sr, duration) {
  const n = Math.floor(sr * duration);
  const out = new Float32Array(n);
  const scale = [261.63, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63, 293.66];
  const step = 0.5;
  const notes = Math.ceil(duration / step);
  for (let k = 0; k < notes; k++) {
    const f = scale[k % scale.length];
    const start = Math.floor(k * step * sr);
    const len = Math.floor(0.46 * sr);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / sr;
      phase += (2 * Math.PI * f) / sr;
      const env = Math.exp(-t * 4.2);
      out[start + i] +=
        (Math.sin(phase) * 0.72 + Math.sin(phase * 2) * 0.22) * env;
    }
  }
  return out;
}

function synthNight(sr, duration) {
  const n = Math.floor(sr * duration);
  const out = new Float32Array(n);
  let droneA = 0;
  let droneB = 0;
  for (let i = 0; i < n; i++) {
    droneA += (2 * Math.PI * 110) / sr;
    droneB += (2 * Math.PI * 164.81) / sr;
    const trem = 0.86 + 0.14 * Math.sin((2 * Math.PI * 0.07 * i) / sr);
    out[i] += (Math.sin(droneA) * 0.2 + Math.sin(droneB) * 0.1) * trem;
  }
  const scale = [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 246.94];
  const step = 0.8;
  const notes = Math.ceil(duration / step);
  for (let k = 0; k < notes; k++) {
    const f = scale[k % scale.length];
    const start = Math.floor(k * step * sr);
    const len = Math.floor(0.72 * sr);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / sr;
      phase += (2 * Math.PI * f) / sr;
      const env = Math.exp(-t * 2.3) * (1 - Math.exp(-t * 16));
      out[start + i] += (Math.sin(phase) * 0.34 + Math.sin(phase * 2) * 0.08) * env;
    }
  }
  return out;
}

/**
 * Mix placed calls over a ducked music bed. Returns a Float32Array of `duration` seconds.
 * `bed: "night"` is the study-room loop. Animal calls keep the original day bed.
 */
export function mixEpisode({ clips, lines, duration, sampleRate = SAMPLE_RATE, bed = "day" }) {
  const n = Math.floor(sampleRate * duration);
  const sfx = new Float32Array(n);
  const activity = new Float32Array(n);

  for (const line of lines) {
    const key = line.audioKey || line.sound;
    const clip = key ? clips[key] : null;
    if (clip) {
      const offset = Math.floor(line.start * sampleRate);
      const samples = clip.samples;
      for (let i = 0; i < samples.length && offset + i < n; i++) {
        sfx[offset + i] += samples[i];
        activity[offset + i] = 1;
      }
    }
    if (line.sfx && clips[line.sfx]) {
      const fx = clips[line.sfx];
      const offset = Math.floor((line.start + (line.sfxDelay || 0)) * sampleRate);
      const gain = line.sfxGain ?? 0.8;
      const samples = fx.samples;
      for (let i = 0; i < samples.length && offset + i < n; i++) {
        sfx[offset + i] += samples[i] * gain;
      }
    }
  }

  const music = bed === "night" ? synthNight(sampleRate, duration) : synthMusic(sampleRate, duration);
  const musicBase = bed === "night" ? 0.2 : 0.16;
  const mix = new Float32Array(n);
  let env = 0;
  for (let i = 0; i < n; i++) {
    const target = activity[i] > 0 ? 1 : 0;
    const coeff = target > env ? 0.01 : 0.00018;
    env += (target - env) * coeff;
    const fadeIn = Math.min(1, i / (0.3 * sampleRate));
    const fadeOut = Math.min(1, (n - i) / (0.45 * sampleRate));
    const musicGain = musicBase * (1 - 0.78 * env) * fadeIn * fadeOut;
    mix[i] = sfx[i] * 0.92 + music[i] * musicGain;
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i]));
  if (peak > 0.98) {
    const g = 0.98 / peak;
    for (let i = 0; i < n; i++) mix[i] *= g;
  }
  return { samples: mix, sampleRate, duration };
}

export function encodeWav(samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

export function envelopeFromSamples(samples, sampleRate) {
  return envelopeOf(samples, sampleRate);
}

function envelopeOf(samples, sampleRate) {
  const win = 512;
  const hop = 256;
  const values = [];
  for (let i = 0; i < samples.length; i += hop) {
    const end = Math.min(samples.length, i + win);
    let e = 0;
    for (let j = i; j < end; j++) e += samples[j] * samples[j];
    values.push(Math.sqrt(e / (end - i)));
  }
  let peak = 0;
  for (const v of values) peak = Math.max(peak, v);
  const norm = values.map((v) => (peak > 1e-8 ? Math.pow(v / peak, 0.55) : 0));
  return {
    hop,
    sampleRate,
    duration: samples.length / sampleRate,
    values: norm,
  };
}

function makeNoise(n, seed) {
  let s = seed >>> 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 4294967296 * 2 - 1;
  }
  return out;
}

function lowpass(input, cutoff, sr) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sr;
  const a = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    y += a * (input[i] - y);
    out[i] = y;
  }
  return out;
}

function normalize(samples, peakTarget) {
  let m = 0;
  for (let i = 0; i < samples.length; i++) m = Math.max(m, Math.abs(samples[i]));
  if (m < 1e-8) return;
  const g = peakTarget / m;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
}

function fadeEdges(samples, sr) {
  const n = Math.min(samples.length >> 1, Math.floor(sr * 0.008));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    samples[i] *= g;
    samples[samples.length - 1 - i] *= g;
  }
}
