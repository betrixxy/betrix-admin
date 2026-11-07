import { readFileSync } from "node:fs";
import { decodeSpans, secondsOf, type Span } from "../reel/audio-track";
import { findCached, OUTPUT_FORMAT, synthesize, type Alignment, type TtsRequest } from "../reel/tts";
import { VOICE_PROFILES, type VoiceProfile, type VoiceProfileId } from "../reel/voice";
import { wordsOf } from "./build";
import { gatePauses } from "./gate";
import type { PlanItem } from "./plan";
import type { VoicedBeat } from "./timeline";
import { tighten } from "./tighten";

/**
 * Taktik tahtası seslendirmesi: beat başına bir istek (sahne önbelleği; metin, ses, model, ayar aynıysa kredi yok; eski biçimde
 * önbellekteki ses de kullanılır). Profil seçilebilir (varsayılan "büyük maç": Orçun, eleven_v4, hız 1,05 sabit); ses etiketi
 * ([excited]) yalnız etiket açık profilde gider. Yeni üretim mp3_44100_192 (PCM Creator planında yok, kullanıcı 2026-11-07).
 * Cümle içi duraklama ortadan kesilerek ≤ 0,22 sn; ses hızlandırılmaz; duraklamalar 24 dB kısılır (`gate.ts`).
 */

export const DEFAULT_PROFILE: VoiceProfileId = "buyuk-mac";
export const profileOf = (id: string | null | undefined): VoiceProfile => {
  if (id && !(id in VOICE_PROFILES)) throw new Error(`Bilinmeyen ses profili: ${id} (${Object.keys(VOICE_PROFILES).join(", ")})`);
  return VOICE_PROFILES[(id as VoiceProfileId | null | undefined) ?? DEFAULT_PROFILE];
};
export const request = (text: string, profile: VoiceProfile): TtsRequest => ({ text, voiceId: profile.voiceId, modelId: profile.modelId, settings: profile.settings });
/** ElevenLabs'e giden metin: etiket yalnız etiket açık profilde (büyük maç). */
export const spokenText = (item: PlanItem, profile: VoiceProfile) => {
  const text = item.voiceText ?? item.sentence;
  return profile.tags ? text : text.replace(/\[[a-z ]+\]\s*/gu, "");
};

/**
 * eleven_v4 kredisi karakter başına ölçüldü (2026-11-07: 568 karakter → 249, 99 karakter → 44 kredi ≈ 0,44); tahmin temkinli 0,5.
 * Gerçek harcama yanıt başlığından (`character-cost`) alınır ve sınırla ayrıca denetlenir.
 */
export const CREDITS_PER_CHARACTER = 0.5;

/** Önbellekte olmayan beat'ler ve tahmini kredi. */
export function creditPlan(items: readonly PlanItem[], cacheDir: string, profile: VoiceProfile): { fresh: string[]; estimatedCredits: number } {
  const fresh = items.filter((item) => !findCached(request(spokenText(item, profile), profile), cacheDir));
  return { fresh: fresh.map((item) => item.kind), estimatedCredits: Math.ceil(fresh.reduce((sum, item) => sum + spokenText(item, profile).length, 0) * CREDITS_PER_CHARACTER) };
}

export interface Voiced { beats: VoicedBeat[]; clips: Float32Array[]; credits: number; formats: string[]; notes: string[] }

export async function voice(items: readonly PlanItem[], cacheDir: string, apiKey: string | null, creditLimit: number, profile: VoiceProfile): Promise<Voiced> {
  const { estimatedCredits } = creditPlan(items, cacheDir, profile);
  if (estimatedCredits > creditLimit) throw new Error(`tahmini kredi ${estimatedCredits} > sınır ${creditLimit}`);
  if (estimatedCredits > 0 && !apiKey) throw new Error("ELEVENLABS_API_KEY yok");
  const beats: VoicedBeat[] = [];
  const clips: Float32Array[] = [];
  const formats: string[] = [];
  const notes: string[] = [];
  let credits = 0;
  for (const item of items) {
    const wanted = request(spokenText(item, profile), profile);
    const result = await synthesize(wanted, { apiKey: apiKey ?? "", cacheDir, format: OUTPUT_FORMAT });
    credits += result.credits;
    if (credits > creditLimit) throw new Error(`harcanan kredi ${credits} > sınır ${creditLimit}`);
    const hit = findCached(wanted, cacheDir) ?? (() => { throw new Error(`${item.kind}: önbellek yazılmadı`); })();
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
