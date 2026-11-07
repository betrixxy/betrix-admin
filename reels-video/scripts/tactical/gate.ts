import { RATE } from "../reel/audio-track";
import { rms } from "./sfx";

/**
 * Duraklama kapısı: yalnız en az 60 ms süren sessiz bölümler (klibin kendi seviyesine göre ≈ −26 dB altı) 24 dB kısılır; giriş/çıkış
 * 15 ms yumuşak. Konuşma, sözcük sonu sönümü ve kısa ünsüzler (< 60 ms) dokunulmaz. Amaç sessiz bölümde gürültü tabanı ≤ −60 dB.
 */

const WINDOW = Math.round(0.01 * RATE);
const MIN_RUN = 6; // 60 ms
const RAMP = Math.round(0.015 * RATE);
const FLOOR = 10 ** (-24 / 20);

export function gatePauses(samples: Float32Array): Float32Array {
  const frames = samples.length / 2;
  const threshold = rms(samples) * 0.05;
  const windows = Math.ceil(frames / WINDOW);
  const quiet: boolean[] = [];
  for (let w = 0; w < windows; w += 1) {
    let sum = 0, count = 0;
    for (let i = w * WINDOW; i < Math.min(frames, (w + 1) * WINDOW); i += 1) { const l = samples[i * 2] ?? 0, r = samples[i * 2 + 1] ?? 0; sum += (l * l + r * r) / 2; count += 1; }
    quiet.push(Math.sqrt(sum / Math.max(1, count)) < threshold);
  }
  const gain = new Float32Array(frames).fill(1);
  let run = -1;
  for (let w = 0; w <= windows; w += 1) {
    const isQuiet = w < windows && quiet[w];
    if (isQuiet && run < 0) run = w;
    if (!isQuiet && run >= 0) {
      if (w - run >= MIN_RUN) {
        const from = run * WINDOW, to = Math.min(frames, w * WINDOW);
        for (let i = from; i < to; i += 1) {
          const edge = Math.min(i - from, to - 1 - i);
          const t = Math.min(1, edge / RAMP);
          gain[i] = 1 - (1 - FLOOR) * (0.5 - 0.5 * Math.cos(Math.PI * t));
        }
      }
      run = -1;
    }
  }
  const out = new Float32Array(samples.length);
  for (let i = 0; i < frames; i += 1) { out[i * 2] = (samples[i * 2] ?? 0) * (gain[i] ?? 1); out[i * 2 + 1] = (samples[i * 2 + 1] ?? 0) * (gain[i] ?? 1); }
  return out;
}
