import { RATE } from "../reel/audio-track";

/**
 * Efekt sesi KODLA üretilir (lisans gerekmez, dış kaynak yok). 2026-11-07 kullanıcı kararı: gürültü tabanlı ambiyans ve whoosh
 * kaldırıldı ("üfleme/hışırtı"); yalnız saf sinüs tık kalır. Çıktı 48 kHz stereo iç içe float.
 */
export const SFX_SOURCE = "Tık sesi betrix-studio kodunda üretildi: reels-video/scripts/tactical/sfx.ts (saf sinüs, gürültü yok; dış ses dosyası/lisans yok).";

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
