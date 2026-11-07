import { RATE } from "../reel/audio-track";

/**
 * Efekt sesleri KODLA üretilir (lisans gerekmez, dış kaynak yok): sabit tohumlu gürültü + filtre, her videoda birebir aynı.
 * Kaynak kaydı: `SFX_SOURCE`. Çıktı 48 kHz stereo iç içe float.
 */
export const SFX_SOURCE = "Efektler (saha ambiyansı, whoosh, tık) betrix-studio kodunda üretildi: reels-video/scripts/tactical/sfx.ts (sabit tohumlu gürültü + filtre; dış ses dosyası/lisans yok).";

function rng(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 * 2 - 1; };
}

const stereo = (mono: Float32Array, spread = 0): Float32Array => {
  const out = new Float32Array(mono.length * 2);
  for (let i = 0; i < mono.length; i += 1) { out[i * 2] = mono[i] ?? 0; out[i * 2 + 1] = mono[Math.max(0, i - spread)] ?? 0; }
  return out;
};

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const value of samples) sum += value * value;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

export function scaleTo(samples: Float32Array, targetRms: number): Float32Array {
  const gain = targetRms / Math.max(1e-9, rms(samples));
  for (let i = 0; i < samples.length; i += 1) samples[i] = (samples[i] ?? 0) * gain;
  return samples;
}

/** Saha ambiyansı: kahverengi gürültü (uzak kalabalık uğultusu) + yavaş dalgalanma, uçlarda 0,5 sn giriş/çıkış. */
export function ambience(seconds: number): Float32Array {
  const next = rng(20261107);
  const n = Math.ceil(seconds * RATE);
  const mono = new Float32Array(n);
  let brown = 0, low = 0;
  for (let i = 0; i < n; i += 1) {
    brown = (brown + 0.02 * next()) / 1.02;
    low += 0.08 * (next() - low);
    const swell = 0.8 + 0.2 * Math.sin((2 * Math.PI * i) / (RATE * 6.3)) * Math.sin((2 * Math.PI * i) / (RATE * 2.1));
    const edge = Math.min(1, i / (RATE * 0.5), (n - i) / (RATE * 0.5));
    mono[i] = (brown * 3 + low * 0.3) * swell * edge;
  }
  return stereo(mono, 37);
}

/** Whoosh: 0,35 sn bant geçiren gürültü, frekansı yükselip düşer. */
export function whoosh(): Float32Array {
  const next = rng(7);
  const n = Math.round(0.35 * RATE);
  const mono = new Float32Array(n);
  let lowA = 0, lowB = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * t);
    lowA += cutoff * (next() - lowA);
    lowB += cutoff * 0.5 * (lowA - lowB);
    const env = Math.sin(Math.PI * t) ** 2;
    mono[i] = (lowA - lowB) * env;
  }
  return stereo(mono, 24);
}

/** Tık: 2,4 kHz + 4,8 kHz, 45 ms üstel sönüm. Kontrol kutusu ve logodaki ✓ için aynı ses. */
export function tick(): Float32Array {
  const n = Math.round(0.06 * RATE);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    mono[i] = (Math.sin(2 * Math.PI * 2400 * t) + 0.4 * Math.sin(2 * Math.PI * 4800 * t)) * Math.exp(-t / 0.012) * Math.min(1, i / 24);
  }
  return stereo(mono);
}
