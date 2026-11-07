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
/** Zaman damgası yoksa süre bayt sayısından: biçimin bit hızı ("mp3_44100_192" → 24 000 B/sn). */
const bytesPerSecond = (format: string) => (Number(format.split("_").at(-1)) || 128) * 1000 / 8;

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
}

/** Yalnız sesi değiştiren alanlar: sıra farkı yeniden üretim yaptırmaz. */
export function ttsCacheKey(request: TtsRequest, format: string = OUTPUT_FORMAT): string {
  const settings = request.settings ? Object.entries(request.settings).sort(([a], [b]) => a.localeCompare(b)) : null;
  const canonical = JSON.stringify({ text: request.text, voice: request.voiceId, model: request.modelId, settings, format });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Önbellekteki ses (önce güncel biçim, sonra eski biçimler); yoksa null. */
export function findCached(request: TtsRequest, cacheDir: string): { audioFile: string; metaFile: string; format: string } | null {
  for (const format of [OUTPUT_FORMAT, ...LEGACY_FORMATS]) {
    const key = ttsCacheKey(request, format);
    const audioFile = path.join(cacheDir, `${key}.mp3`);
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
  const key = ttsCacheKey(request);
  const audioFile = path.join(deps.cacheDir, `${key}.mp3`);
  const metaFile = path.join(deps.cacheDir, `${key}.json`);
  if (hit) {
    const meta = JSON.parse(readFileSync(hit.metaFile, "utf8")) as { alignment: Alignment | null; credits: number };
    const audio = readFileSync(hit.audioFile);
    return { audio, alignment: meta.alignment, seconds: secondsOf(audio, meta.alignment, hit.format), credits: 0, originalCredits: meta.credits, cached: true };
  }
  const run = deps.fetch ?? fetch;
  const body = JSON.stringify({ text: request.text, model_id: request.modelId, ...(request.settings ? { voice_settings: request.settings } : {}) });
  const headers = { "xi-api-key": deps.apiKey, "Content-Type": "application/json" };
  const url = (suffix: string) => `${API}/v1/text-to-speech/${encodeURIComponent(request.voiceId)}${suffix}?output_format=${OUTPUT_FORMAT}`;

  let audio: Buffer;
  let alignment: Alignment | null = null;
  let credits: number;
  const timed = await run(url("/with-timestamps"), { method: "POST", headers, body });
  if (timed.ok) {
    const json = (await timed.json()) as { audio_base64: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
    audio = Buffer.from(json.audio_base64, "base64");
    alignment = json.alignment ?? json.normalized_alignment ?? null;
    credits = costOf(timed, request.text);
  } else if (timed.status === 400 || timed.status === 404 || timed.status === 422) {
    // Bazı modeller zaman damgası vermez. Reddedilen istek kredi harcamaz; düz uç denenir.
    const plain = await run(url(""), { method: "POST", headers, body });
    if (!plain.ok) throw await failure(plain, "üretim reddedildi");
    audio = Buffer.from(await plain.arrayBuffer());
    credits = costOf(plain, request.text);
  } else {
    throw await failure(timed, "üretim başarısız");
  }
  mkdirSync(deps.cacheDir, { recursive: true });
  writeFileSync(audioFile, audio);
  writeFileSync(metaFile, JSON.stringify({ request: { ...request }, alignment, credits }));
  return { audio, alignment, seconds: secondsOf(audio, alignment), credits, originalCredits: credits, cached: false };
}

export async function elevenGet<T>(pathname: string, deps: Pick<TtsDeps, "apiKey" | "fetch">): Promise<T> {
  const response = await (deps.fetch ?? fetch)(`${API}${pathname}`, { headers: { "xi-api-key": deps.apiKey } });
  if (!response.ok) throw await failure(response, pathname.split("?")[0] ?? pathname);
  return (await response.json()) as T;
}
