import { RATE } from "../reel/audio-track";
import { rms } from "./sfx";

/**
 * Cümle içi duraklamaları kısaltır: ses hızlandırılmaz, yalnız sessiz bölümün ortası kesilir (10 ms yumuşak eklem). Sessizlik eşiği,
 * −14 LUFS'a normalize edilmiş seste −35 dBFS'e karşılık gelecek şekilde klibin kendi seviyesinden (≈ RMS × 0,15). Baştaki ve
 * sondaki sessizlik `lead` / `tail` saniyeye indirilir. Dönen `map` eski zamanı (klip içi sn) yeni zamana çevirir: altyazı için.
 */

const WINDOW = Math.round(0.01 * RATE);
const JOIN = Math.round(0.01 * RATE);

export interface Tightened { samples: Float32Array; map: (seconds: number) => number; removed: number }

export function tighten(samples: Float32Array, options: { maxGap: number; lead: number; tail: number }): Tightened {
  const frames = samples.length / 2;
  const threshold = rms(samples) * 0.15;
  const windows = Math.ceil(frames / WINDOW);
  const quiet: boolean[] = [];
  for (let w = 0; w < windows; w += 1) {
    let sum = 0, count = 0;
    for (let i = w * WINDOW; i < Math.min(frames, (w + 1) * WINDOW); i += 1) { const l = samples[i * 2] ?? 0, r = samples[i * 2 + 1] ?? 0; sum += (l * l + r * r) / 2; count += 1; }
    quiet.push(Math.sqrt(sum / Math.max(1, count)) < threshold);
  }
  // Kesilecek aralıklar (örnek karesi cinsinden).
  const cuts: { from: number; to: number }[] = [];
  const firstLoud = quiet.indexOf(false);
  const lastLoud = quiet.lastIndexOf(false);
  if (firstLoud < 0) return { samples, map: (s) => s, removed: 0 };
  const leadKeep = Math.round(options.lead * RATE);
  if (firstLoud * WINDOW > leadKeep) cuts.push({ from: 0, to: firstLoud * WINDOW - leadKeep });
  let run = -1;
  for (let w = firstLoud; w <= lastLoud; w += 1) {
    if (quiet[w] && run < 0) run = w;
    if (!quiet[w] && run >= 0) {
      const length = (w - run) * WINDOW;
      const keep = Math.round(options.maxGap * RATE);
      if (length > keep) { const start = run * WINDOW + Math.floor(keep / 2); cuts.push({ from: start, to: start + (length - keep) }); }
      run = -1;
    }
  }
  const tailKeep = Math.round(options.tail * RATE);
  const tailStart = (lastLoud + 1) * WINDOW;
  if (frames - tailStart > tailKeep) cuts.push({ from: tailStart + tailKeep, to: frames });
  // Kalan parçaları eklemlerde 10 ms çapraz geçişle birleştir.
  const keepParts: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const cut of cuts) { if (cut.from > cursor) keepParts.push({ from: cursor, to: cut.from }); cursor = cut.to; }
  if (cursor < frames) keepParts.push({ from: cursor, to: frames });
  const total = keepParts.reduce((sum, part) => sum + (part.to - part.from), 0);
  const out = new Float32Array(total * 2);
  let at = 0;
  keepParts.forEach((part, index) => {
    for (let i = part.from; i < part.to; i += 1) {
      const local = i - part.from;
      const fromEnd = part.to - 1 - i;
      const fadeIn = index > 0 ? Math.min(1, local / JOIN) : 1;
      const fadeOut = index < keepParts.length - 1 ? Math.min(1, fromEnd / JOIN) : 1;
      const gain = Math.min(fadeIn, fadeOut);
      out[at * 2] = (samples[i * 2] ?? 0) * gain;
      out[at * 2 + 1] = (samples[i * 2 + 1] ?? 0) * gain;
      at += 1;
    }
  });
  const map = (seconds: number) => {
    const sample = seconds * RATE;
    let removedBefore = 0;
    for (const cut of cuts) {
      if (sample >= cut.to) removedBefore += cut.to - cut.from;
      else if (sample > cut.from) removedBefore += sample - cut.from;
    }
    return Math.max(0, (sample - removedBefore) / RATE);
  };
  return { samples: out, map, removed: (frames - total) / RATE };
}
