import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ttsCacheKey, type Alignment, type TtsRequest } from "./tts";

/**
 * Ses izi (kalite kuralları 11-06): sahne klipleri 40 ms yumuşak giriş/çıkış ile yerine konur (çıt yok), iz iki geçişli loudnorm ile
 * −14 LUFS / −1 dBTP'ye çekilir, AAC 48 kHz 192 kbps stereo yazılır; kırpılma örnek düzeyinde sayılır. Uygulamanın ffmpeg'i
 * (Remotion) kullanılır; içinde afade/astats yok, bu yüzden geçiş ve tepe denetimi burada yapılır.
 */

const BIN = path.resolve(import.meta.dirname, "../../node_modules/@remotion/compositor-win32-x64-msvc");
export const FFMPEG = path.join(BIN, "ffmpeg.exe");
export const FFPROBE = path.join(BIN, "ffprobe.exe");
export const RATE = 48000;
const FADE = 0.04;
export const TARGET = { lufs: -14, truePeak: -1 } as const;

const run = (args: string[]) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 30 });

/** Önbellekten okur; yoksa hata (kredi harcamaz). */
export function cachedVoice(request: TtsRequest, cacheDir: string): { file: string; alignment: Alignment | null } {
  const key = ttsCacheKey(request);
  const file = path.join(cacheDir, `${key}.mp3`);
  const meta = path.join(cacheDir, `${key}.json`);
  if (!existsSync(file) || !existsSync(meta)) throw new Error(`önbellekte ses yok: ${request.text.slice(0, 40)}…`);
  return { file, alignment: (JSON.parse(readFileSync(meta, "utf8")) as { alignment: Alignment | null }).alignment };
}

export interface Span { start: number; end: number }

/**
 * Çıkarılan cümleler dışında kalan konuşma aralıkları (saniye, sırayla). Boşluk ve ses etiketi ("[short pause]") kalan bölüme
 * sayılmaz; her aralık konuşmanın ilk harfinden 60 ms önce başlar, son harfinden 150 ms sonra biter (doğal sönüm).
 */
export function keptSpans(alignment: Alignment, dropped: readonly string[]): Span[] {
  const text = alignment.characters.join("");
  const removed = new Array<boolean>(text.length).fill(false);
  for (const sentence of dropped) {
    const at = text.indexOf(sentence);
    if (at < 0) throw new Error(`zaman damgasında cümle bulunamadı: ${sentence}`);
    for (let i = at; i < at + sentence.length; i += 1) removed[i] = true;
  }
  // Etiketler ve boşluk konuşma değildir.
  let inTag = false;
  const speech = [...text].map((char, i) => {
    if (char === "[") inTag = true;
    const keep = !removed[i] && !inTag && !/\s/u.test(char);
    if (char === "]") inTag = false;
    return keep;
  });
  const spans: Span[] = [];
  let i = 0;
  while (i < text.length) {
    if (!speech[i]) { i += 1; continue; }
    let j = i;
    // Kalan bölüm içindeki boşluk ve etiket aralığı bölmez; yalnız çıkarılan cümle böler.
    while (j + 1 < text.length && !removed[j + 1]) j += 1;
    while (j > i && !speech[j]) j -= 1;
    spans.push({ start: Math.max(0, (alignment.character_start_times_seconds[i] ?? 0) - 0.06), end: (alignment.character_end_times_seconds[j] ?? 0) + 0.15 });
    i = j + 1;
  }
  if (!spans.length) throw new Error("kesimden sonra konuşma kalmadı");
  return spans;
}

/** Aralıkları ayrı çözer, her birini yumuşak giriş/çıkışla birleştirir (eklem yerinde çıt olmaz). */
export function decodeSpans(file: string, spans: readonly Span[] | null): Float32Array {
  if (!spans) return fade(decode(file, null));
  const parts = spans.map((span) => fade(decode(file, span)));
  const out = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/**
 * Ses → 48 kHz stereo float örnekler (iç içe), isteğe bağlı aralıkla. Bu ffmpeg derlemesinde ham PCM çıkışı yok: 16 bit WAV
 * okunur (−1…1). Tam ölçekteki örnek 32767'ye kıstırılır, kırpılma sayımı bunu yakalar.
 */
export function decode(file: string, span: { start: number; end: number } | null): Float32Array {
  const wav = run(["-i", file, ...(span ? ["-ss", span.start.toFixed(3), "-to", span.end.toFixed(3)] : []), "-f", "wav", "-c:a", "pcm_s16le", "-ac", "2", "-ar", String(RATE), "-"]);
  let at = 12;
  while (at + 8 <= wav.length && wav.toString("ascii", at, at + 4) !== "data") at += 8 + wav.readUInt32LE(at + 4);
  const start = at + 8;
  const count = Math.floor((wav.length - start) / 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) samples[i] = wav.readInt16LE(start + i * 2) / 32768;
  return samples;
}

/** Yükseltilmiş kosinüs giriş/çıkış: klip sınırında süreksizlik (çıt) kalmaz. */
export function fade(samples: Float32Array, seconds = FADE): Float32Array {
  const frames = samples.length / 2;
  const width = Math.min(Math.floor(seconds * RATE), Math.floor(frames / 2));
  for (let i = 0; i < width; i += 1) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * i) / width);
    for (const at of [i, frames - 1 - i]) { samples[at * 2] = (samples[at * 2] ?? 0) * gain; samples[at * 2 + 1] = (samples[at * 2 + 1] ?? 0) * gain; }
  }
  return samples;
}

export const secondsOf = (samples: Float32Array) => samples.length / 2 / RATE;

interface Loudness { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string }

/** loudnorm ölçümü JSON olarak stderr'e yazılır. */
function loudness(input: string[]): Loudness {
  const result = spawnSync(FFMPEG, ["-hide_banner", ...input, "-af", `loudnorm=I=${TARGET.lufs}:TP=${TARGET.truePeak}:LRA=11:print_format=json`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const json = /\{[\s\S]*?"target_offset"[\s\S]*?\}/u.exec(result.stderr ?? "");
  if (!json) throw new Error("loudnorm ölçümü okunamadı");
  return JSON.parse(json[0]) as Loudness;
}

/** Klipleri zaman çizelgesine yerleştirir, normalize eder, AAC yazar; ölçümleri döndürür. */
export function buildTrack(clips: { samples: Float32Array; at: number }[], totalSeconds: number, work: string, output: string) {
  const mix = new Float32Array(Math.ceil(totalSeconds * RATE) * 2);
  for (const clip of clips) {
    const offset = Math.round(clip.at * RATE) * 2;
    for (let i = 0; i < clip.samples.length && offset + i < mix.length; i += 1) mix[offset + i] = (mix[offset + i] ?? 0) + (clip.samples[i] ?? 0);
  }
  const raw = path.join(work, "ses-izi.f32");
  writeFileSync(raw, Buffer.from(mix.buffer));
  const input = ["-f", "f32le", "-ar", String(RATE), "-ac", "2", "-i", raw];
  const first = loudness(input);
  const filter = `loudnorm=I=${TARGET.lufs}:TP=${TARGET.truePeak}:LRA=11:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true`;
  // Bu ffmpeg derlemesinde "ipod" (m4a) kabı yok: mp4 kabı açıkça seçilir.
  run([...input, "-af", filter, "-ar", String(RATE), "-ac", "2", "-c:a", "aac", "-b:a", "192k", "-f", "mp4", output]);
  // Doğrulama: çıkış dosyası yeniden ölçülür; kırpılma örnek düzeyinde sayılır.
  const final = loudness(["-i", output]);
  const decoded = decode(output, null);
  let clipped = 0;
  let peak = 0;
  for (const value of decoded) { const level = Math.abs(value); peak = Math.max(peak, level); if (level >= 32766 / 32768) clipped += 1; }
  return { before: { lufs: Number(first.input_i), truePeak: Number(first.input_tp) }, after: { lufs: Number(final.input_i), truePeak: Number(final.input_tp) }, samplePeakDb: Number((20 * Math.log10(Math.max(peak, 1e-9))).toFixed(2)), clippedSamples: clipped };
}
