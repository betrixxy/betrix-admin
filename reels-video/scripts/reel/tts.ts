import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * ElevenLabs seslendirme + kalıcı önbellek. Kredi koruma kuralı: metin, ses kimliği, model ve ayarlar aynıysa istek atılmaz, kredi
 * harcanmaz. Anahtar yalnız istek başlığına girer; hata metnine, günlüğe ve dosyaya yazılmaz.
 */

const API = "https://api.elevenlabs.io";
/**
 * Yeni üretimler 192 kbps mp3 (2026-11-07; Creator planında izinli en yüksek mp3, PCM 44,1 kHz Pro plan ister). Önbellekte
 * eski biçimle (128 kbps) üretilmiş ses de kullanılır: biçim değişti diye yeniden üretilmez, kredi harcanmaz.
 */
export const OUTPUT_FORMAT = "mp3_44100_192";
export const LEGACY_FORMATS = ["mp3_44100_128"] as const;
/** Kayıpsız 44,1 kHz PCM (16 bit mono). ElevenLabs'te Pro plan ister; Creator'da reddedilir (reddedilen istek kredi harcamaz). */
export const PCM_FORMAT = "pcm_44100";
const isPcm = (format: string) => format.startsWith("pcm_");
/** Önbellek dosya uzantısı: PCM WAV başlığıyla saklanır (ffmpeg doğrudan okur). */
export const audioExtension = (format: string) => (isPcm(format) ? "wav" : "mp3");
/** Zaman damgası yoksa süre bayt sayısından: PCM 16 bit mono, mp3 biçimin bit hızı ("mp3_44100_192" → 24 000 B/sn). */
const bytesPerSecond = (format: string) => (isPcm(format) ? Number(format.split("_")[1]) * 2 : ((Number(format.split("_").at(-1)) || 128) * 1000) / 8);

/** Ham PCM (s16le mono) → WAV. */
export function wavFromPcm(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

export interface TtsRequest {
  text: string;
  voiceId: string;
  modelId: string;
  /** null: sesin kendi kayıtlı ayarları. */
  settings: VoiceSettings | null;
}

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface TtsResult {
  audio: Buffer;
  alignment: Alignment | null;
  seconds: number;
  /** Bu çağrıda harcanan kredi: önbellekten dönünce 0. */
  credits: number;
  /** İlk üretimde harcanan kredi. */
  originalCredits: number;
  cached: boolean;
}

export interface TtsDeps {
  apiKey: string;
  cacheDir: string;
  fetch?: typeof fetch;
  /** Yeni üretimin biçimi (varsayılan OUTPUT_FORMAT). Önbellekte başka biçimde aynı ses varsa o kullanılır. */
  format?: string;
}

/** Yalnız sesi değiştiren alanlar: sıra farkı yeniden üretim yaptırmaz. */
export function ttsCacheKey(request: TtsRequest, format: string = OUTPUT_FORMAT): string {
  const settings = request.settings ? Object.entries(request.settings).sort(([a], [b]) => a.localeCompare(b)) : null;
  const canonical = JSON.stringify({ text: request.text, voice: request.voiceId, model: request.modelId, settings, format });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Önbellekteki ses (önce güncel biçim, sonra eski biçimler); yoksa null. */
export function findCached(request: TtsRequest, cacheDir: string): { audioFile: string; metaFile: string; format: string } | null {
  for (const format of [PCM_FORMAT, OUTPUT_FORMAT, ...LEGACY_FORMATS]) {
    const key = ttsCacheKey(request, format);
    const audioFile = path.join(cacheDir, `${key}.${audioExtension(format)}`);
    const metaFile = path.join(cacheDir, `${key}.json`);
    if (existsSync(audioFile) && existsSync(metaFile)) return { audioFile, metaFile, format };
  }
  return null;
}

export class TtsError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) {
    super(message);
  }
}

async function failure(response: Response, what: string): Promise<TtsError> {
  let code: string | null = null;
  try {
    const body = (await response.json()) as { detail?: { status?: unknown; code?: unknown } };
    const value = body.detail?.status ?? body.detail?.code;
    code = typeof value === "string" ? value : null;
  } catch {
    code = null;
  }
  return new TtsError(`ElevenLabs ${what}: HTTP ${response.status}${code ? ` (${code})` : ""}`, response.status, code);
}

const secondsOf = (audio: Buffer, alignment: Alignment | null, format: string = OUTPUT_FORMAT): number => alignment?.character_end_times_seconds.at(-1) ?? audio.length / bytesPerSecond(format);
const costOf = (response: Response, text: string): number => {
  const header = Number(response.headers.get("character-cost"));
  return Number.isFinite(header) && header > 0 ? header : text.length;
};

export async function synthesize(request: TtsRequest, deps: TtsDeps): Promise<TtsResult> {
  const hit = findCached(request, deps.cacheDir);
  const format = deps.format ?? OUTPUT_FORMAT;
  const key = ttsCacheKey(request, format);
  const audioFile = path.join(deps.cacheDir, `${key}.${audioExtension(format)}`);
  const metaFile = path.join(deps.cacheDir, `${key}.json`);
  if (hit) {
    const meta = JSON.parse(readFileSync(hit.metaFile, "utf8")) as { alignment: Alignment | null; credits: number };
    const audio = readFileSync(hit.audioFile);
    return { audio, alignment: meta.alignment, seconds: secondsOf(audio, meta.alignment, hit.format), credits: 0, originalCredits: meta.credits, cached: true };
  }
  const run = deps.fetch ?? fetch;
  const body = JSON.stringify({ text: request.text, model_id: request.modelId, ...(request.settings ? { voice_settings: request.settings } : {}) });
  const headers = { "xi-api-key": deps.apiKey, "Content-Type": "application/json" };
  const url = (suffix: string) => `${API}/v1/text-to-speech/${encodeURIComponent(request.voiceId)}${suffix}?output_format=${format}`;

  let audio: Buffer;
  let alignment: Alignment | null = null;
  let credits: number;
  const timed = await run(url("/with-timestamps"), { method: "POST", headers, body });
  if (timed.ok) {
    const json = (await timed.json()) as { audio_base64: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
    audio = Buffer.from(json.audio_base64, "base64");
    if (isPcm(format)) audio = wavFromPcm(audio, Number(format.split("_")[1]));
    alignment = json.alignment ?? json.normalized_alignment ?? null;
    credits = costOf(timed, request.text);
  } else if (timed.status === 400 || timed.status === 404 || timed.status === 422) {
    // Bazı modeller zaman damgası vermez. Reddedilen istek kredi harcamaz; düz uç denenir.
    const plain = await run(url(""), { method: "POST", headers, body });
    if (!plain.ok) throw await failure(plain, "üretim reddedildi");
    audio = Buffer.from(await plain.arrayBuffer());
    if (isPcm(format)) audio = wavFromPcm(audio, Number(format.split("_")[1]));
    credits = costOf(plain, request.text);
  } else {
    throw await failure(timed, "üretim başarısız");
  }
  mkdirSync(deps.cacheDir, { recursive: true });
  writeFileSync(audioFile, audio);
  writeFileSync(metaFile, JSON.stringify({ request: { ...request }, format, alignment, credits }));
  return { audio, alignment, seconds: secondsOf(isPcm(format) ? audio.subarray(44) : audio, alignment, format), credits, originalCredits: credits, cached: false };
}

export async function elevenGet<T>(pathname: string, deps: Pick<TtsDeps, "apiKey" | "fetch">): Promise<T> {
  const response = await (deps.fetch ?? fetch)(`${API}${pathname}`, { headers: { "xi-api-key": deps.apiKey } });
  if (!response.ok) throw await failure(response, pathname.split("?")[0] ?? pathname);
  return (await response.json()) as T;
}
