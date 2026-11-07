import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { FFMPEG, RATE } from "../reel/audio-track";

/**
 * Ses kalite denetimi (kullanıcı 2026-11-07): sessiz bölümlerde gürültü tabanı ≤ −60 dB ve spektrogram. Uygulamanın ffmpeg derlemesinde
 * `showspectrumpic` yok: spektrogram burada STFT ile hesaplanır (Hann 2048, adım 1024, 0–24 kHz doğrusal, −120…0 dBFS renk).
 */

export interface Silence { start: number; end: number }

export function silences(file: string, noiseDb = -35, minSeconds = 0.05): Silence[] {
  const detect = spawnSync(FFMPEG, ["-hide_banner", "-i", file, "-af", `silencedetect=noise=${noiseDb}dB:d=${minSeconds}`, "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const found: Silence[] = [];
  for (const match of detect.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/gu)) found.push({ start: Number(match[1]), end: Number(match[2]) });
  return found;
}

const db = (value: number) => 20 * Math.log10(Math.max(value, 1e-9));

/**
 * Gürültü tabanı: sessiz aralıkların içi (uçlardan 30 ms içeride), 20 ms pencerelerin RMS'i; sonuç pencerelerin 90. yüzdeliği (tek
 * bir nefes ya da kelime sönümü tabanı bozmasın, ama sürekli hışırtı yakalansın). Tamamen dijital sessizlik −180 dB sayılır.
 */
export function noiseFloor(stereo: Float32Array, gaps: readonly Silence[]): { db: number; windows: number; worstDb: number } {
  const levels: number[] = [];
  const size = Math.round(0.02 * RATE);
  for (const gap of gaps) {
    const from = Math.round((gap.start + 0.03) * RATE);
    const to = Math.round((gap.end - 0.03) * RATE);
    for (let at = from; at + size <= to; at += size) {
      let sum = 0;
      for (let i = at; i < at + size; i += 1) { const l = stereo[i * 2] ?? 0, r = stereo[i * 2 + 1] ?? 0; sum += (l * l + r * r) / 2; }
      levels.push(Math.max(-180, db(Math.sqrt(sum / size))));
    }
  }
  if (!levels.length) return { db: -180, windows: 0, worstDb: -180 };
  const sorted = [...levels].sort((a, b) => a - b);
  return { db: Number((sorted[Math.floor(sorted.length * 0.9)] ?? -180).toFixed(1)), windows: levels.length, worstDb: Number((sorted.at(-1) ?? -180).toFixed(1)) };
}

/** Yerinde radix-2 FFT (gerçek + sanal diziler). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0]; [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k += 1) {
        const wr = Math.cos(angle * k), wi = Math.sin(angle * k);
        const a = i + k, b = i + k + len / 2;
        const xr = (re[b] ?? 0) * wr - (im[b] ?? 0) * wi, xi = (re[b] ?? 0) * wi + (im[b] ?? 0) * wr;
        re[b] = (re[a] ?? 0) - xr; im[b] = (im[a] ?? 0) - xi;
        re[a] = (re[a] ?? 0) + xr; im[a] = (im[a] ?? 0) + xi;
      }
    }
  }
}

/** Renk: koyu → mor → turuncu → sarı → beyaz (−120 … 0 dBFS). */
function color(level: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (level + 120) / 120));
  const stops: [number, [number, number, number]][] = [[0, [0, 0, 4]], [0.35, [60, 15, 110]], [0.6, [190, 55, 80]], [0.8, [250, 150, 30]], [1, [252, 255, 200]]];
  for (let s = 1; s < stops.length; s += 1) {
    const [p1, c1] = stops[s] ?? [1, [255, 255, 255]];
    const [p0, c0] = stops[s - 1] ?? [0, [0, 0, 0]];
    if (t <= p1) { const u = (t - p0) / (p1 - p0); return [0, 1, 2].map((k) => Math.round((c0[k] ?? 0) + ((c1[k] ?? 0) - (c0[k] ?? 0)) * u)) as [number, number, number]; }
  }
  return [255, 255, 255];
}

export async function spectrogram(stereo: Float32Array, output: string): Promise<void> {
  const N = 2048, HOP = 1024, HEIGHT = 512;
  const frames = Math.max(1, Math.floor((stereo.length / 2 - N) / HOP));
  const width = frames;
  const pixels = Buffer.alloc(width * HEIGHT * 3);
  const window = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const norm = N / 4; // Hann penceresinin tutarlı kazancı (tam ölçek sinüs ≈ 0 dBFS)
  for (let x = 0; x < frames; x += 1) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i += 1) { const at = (x * HOP + i) * 2; re[i] = (((stereo[at] ?? 0) + (stereo[at + 1] ?? 0)) / 2) * (window[i] ?? 0); }
    fft(re, im);
    for (let y = 0; y < HEIGHT; y += 1) {
      const bin = Math.floor(((HEIGHT - 1 - y) / HEIGHT) * (N / 2));
      const magnitude = Math.hypot(re[bin] ?? 0, im[bin] ?? 0) / norm;
      const [r, g, b] = color(db(magnitude));
      const at = (y * width + x) * 3;
      pixels[at] = r; pixels[at + 1] = g; pixels[at + 2] = b;
    }
  }
  await sharp(pixels, { raw: { width, height: HEIGHT, channels: 3 } }).png().toFile(output);
}
