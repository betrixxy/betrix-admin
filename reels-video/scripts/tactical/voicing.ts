import { readFileSync } from "node:fs";
import { decodeSpans, secondsOf, type Span } from "../reel/audio-track";
import { findCached, OUTPUT_FORMAT, PCM_FORMAT, synthesize, TtsError, type Alignment, type TtsRequest } from "../reel/tts";
import { VOICE_PROFILES } from "../reel/voice";
import { wordsOf } from "./build";
import { gatePauses } from "./gate";
import type { PlanItem } from "./plan";
import type { VoicedBeat } from "./timeline";
import { tighten } from "./tighten";

/**
 * Taktik tahtası seslendirmesi: beat başına bir istek (sahne önbelleği; metin, ses, model, ayar aynıysa kredi yok; eski biçimde
 * önbellekteki ses de kullanılır). Profil "büyük maç" (Orçun, eleven_v4, hız 1,05 sabit), etiket yok. Cümle içi duraklama ortadan
 * kesilerek ≤ 0,22 sn; ses hızlandırılmaz; duraklamalar 24 dB kısılır (`gate.ts`).
 */

export const PROFILE = VOICE_PROFILES["buyuk-mac"];
export const request = (text: string): TtsRequest => ({ text, voiceId: PROFILE.voiceId, modelId: PROFILE.modelId, settings: PROFILE.settings });
/** ElevenLabs'e giden metin: kancada ses etiketi ([excited]) dahil. */
export const spokenText = (item: PlanItem) => item.voiceText ?? item.sentence;
/** Yeni üretim biçimi: kayıpsız PCM 44,1 kHz (kullanıcı 2026-11-07). Plan izin vermezse (Pro) 192 kbps mp3'e düşülür ve raporlanır. */
export const NEW_FORMAT = PCM_FORMAT;

/** Önbellekte olmayan beat'ler ve tahmini kredi (ElevenLabs karakter başına; gerçek harcama yanıt başlığından raporlanır). */
export function creditPlan(items: readonly PlanItem[], cacheDir: string): { fresh: string[]; estimatedCredits: number } {
  const fresh = items.filter((item) => !findCached(request(spokenText(item)), cacheDir));
  return { fresh: fresh.map((item) => item.kind), estimatedCredits: fresh.reduce((sum, item) => sum + spokenText(item).length, 0) };
}

export interface Voiced { beats: VoicedBeat[]; clips: Float32Array[]; credits: number; formats: string[]; notes: string[] }

export async function voice(items: readonly PlanItem[], cacheDir: string, apiKey: string | null, creditLimit: number): Promise<Voiced> {
  const { estimatedCredits } = creditPlan(items, cacheDir);
  if (estimatedCredits > creditLimit) throw new Error(`tahmini kredi ${estimatedCredits} > sınır ${creditLimit}`);
  if (estimatedCredits > 0 && !apiKey) throw new Error("ELEVENLABS_API_KEY yok");
  const beats: VoicedBeat[] = [];
  const clips: Float32Array[] = [];
  const formats: string[] = [];
  const notes: string[] = [];
  let credits = 0;
  for (const item of items) {
    const deps = { apiKey: apiKey ?? "", cacheDir };
    let result;
    try {
      result = await synthesize(request(spokenText(item)), { ...deps, format: NEW_FORMAT });
    } catch (error) {
      // Reddedilen istek kredi harcamaz; PCM plan dışıysa 192 kbps mp3 (sessizce değil: rapora yazılır).
      if (!(error instanceof TtsError) || ![400, 401, 403, 422].includes(error.status)) throw error;
      notes.push(`${item.kind}: ${NEW_FORMAT} reddedildi (${error.message}); ${OUTPUT_FORMAT} ile üretildi`);
      result = await synthesize(request(spokenText(item)), { ...deps, format: OUTPUT_FORMAT });
    }
    credits += result.credits;
    if (credits > creditLimit) throw new Error(`harcanan kredi ${credits} > sınır ${creditLimit}`);
    const hit = findCached(request(spokenText(item)), cacheDir) ?? (() => { throw new Error(`${item.kind}: önbellek yazılmadı`); })();
    formats.push(hit.format);
    const alignment = (JSON.parse(readFileSync(hit.metaFile, "utf8")) as { alignment: Alignment | null }).alignment;
    if (!alignment) throw new Error(`${item.kind}: zaman damgası yok`);
    const last = alignment.character_end_times_seconds.at(-1) ?? 0;
    const span: Span = { start: Math.max(0, (alignment.character_start_times_seconds[0] ?? 0) - 0.06), end: last + 0.15 };
    const tight = tighten(decodeSpans(hit.audioFile, [span]), { maxGap: 0.22, lead: 0.03, tail: 0.12 });
    clips.push(gatePauses(tight.samples));
    beats.push({
      item,
      seconds: secondsOf(tight.samples),
      words: wordsOf(alignment, span.start, span.end).map((word) => ({ text: word.text, start: tight.map(word.start - span.start), end: tight.map(word.end - span.start) })),
    });
  }
  return { beats, clips, credits, formats, notes };
}
