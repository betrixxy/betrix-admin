import type { ReelScene } from "../../src/schema";
import type { VoiceSettings } from "./tts";

/**
 * Ses profilleri ve seslendirme metni. Saf: ağa çıkmaz. Ses kimlikleri ve ayarlar ses örneği üretimindekiyle birebir aynı
 * (`scripts/voice-samples.ts`), önbellek anahtarı tutarlı kalsın diye. Ekran metnine dokunulmaz: etiket ve okunuş düzeltmesi
 * yalnız ElevenLabs'e giden metinde.
 */

export type VoiceProfileId = "buyuk-mac" | "standart" | "alternatif";

export interface VoiceProfile {
  id: VoiceProfileId;
  label: string;
  voiceName: string;
  voiceId: string;
  modelId: string;
  settings: VoiceSettings;
  /** Ses etiketleri yalnız bu profilde açık. */
  tags: boolean;
  /** Örnek metinden ölçülen konuşma hızı (sözcük/sn), `canli` ayarıyla. Süre tahmini için; gerçek süre sesten ölçülür. */
  wordsPerSecond: number;
}

/** `voice-samples.ts::LIVE` ile aynı değerler. */
export const LIVE_SETTINGS: VoiceSettings = { stability: 0.4, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.05 };
const MODEL = "eleven_v4";
/** Örnek metin 44 sözcük; `canli` v4 süreleri 11-05 üretiminden (KARSILASTIRMA.md). */
const SAMPLE_WORDS = 44;

export const VOICE_PROFILES: Readonly<Record<VoiceProfileId, VoiceProfile>> = {
  "buyuk-mac": { id: "buyuk-mac", label: "Büyük maç", voiceName: "Orcun Togan - Engaging and Warm", voiceId: "c9eIhSvMHBxtYhLX4oBt", modelId: MODEL, settings: LIVE_SETTINGS, tags: true, wordsPerSecond: SAMPLE_WORDS / 18.4 },
  standart: { id: "standart", label: "Standart", voiceName: "Mert - Energetic, Natural and Friendly", voiceId: "01p4omegjS2n3rSDCM5u", modelId: MODEL, settings: LIVE_SETTINGS, tags: false, wordsPerSecond: SAMPLE_WORDS / 18.7 },
  alternatif: { id: "alternatif", label: "Alternatif", voiceName: "Mustafa Silici - Voice Actor", voiceId: "fg8pljYEn5ahwjyOQaro", modelId: MODEL, settings: LIVE_SETTINGS, tags: false, wordsPerSecond: SAMPLE_WORDS / 20.5 },
};

/** Büyük maç önerisi: dört büyükler arası derbi, Şampiyonlar Ligi, Türk takımının Avrupa maçı. Öneridir; panelde değiştirilebilir. */
const BIG_FOUR = new Set([645, 611, 549, 998]);
const CHAMPIONS_LEAGUE = 2;
const EUROPEAN = new Set([2, 3, 848, 531]);

export function bigMatchReason(input: { leagueId: number; homeId: number; awayId: number; isTurkish: (teamId: number) => boolean }): string | null {
  if (input.leagueId === CHAMPIONS_LEAGUE) return "Şampiyonlar Ligi";
  if (BIG_FOUR.has(input.homeId) && BIG_FOUR.has(input.awayId)) return "derbi";
  if (EUROPEAN.has(input.leagueId) && (input.isTurkish(input.homeId) || input.isTurkish(input.awayId))) return "Türk takımının Avrupa maçı";
  return null;
}

export const defaultProfile = (bigMatch: boolean): VoiceProfileId => (bigMatch ? "buyuk-mac" : "standart");

/** Örnek üretiminde çalıştığı doğrulanan etiketler. Başka etiket yazılmaz. */
export const ALLOWED_TAGS = ["excited", "short pause", "curious", "whispers"] as const;
export type AudioTag = (typeof ALLOWED_TAGS)[number];
export const MAX_TAGS = 5;
const TAG_PATTERN = /\[(?:[a-z ]+)\]\s*/gu;

/** Okunuş: ekranda "xG" kalır, seste "gol beklentisi". */
export const pronounce = (text: string): string => text.replace(/\bxG\b/gu, "gol beklentisi");
export const stripTags = (text: string): string => text.replace(TAG_PATTERN, "").replace(/\s{2,}/gu, " ").trim();

interface Placement { scene: number; tag: AudioTag; at: "start" | { afterSentence: number } | { beforeSentence: number } }

const sentences = (text: string): string[] => text.match(/[^.?!…]+[.?!…]+|[^.?!…]+$/gu)?.map((part) => part.trim()).filter(Boolean) ?? [text];

/** Sahne başına aday etiketler, öncelik sırasıyla: kanca → sürpriz/gerilim → soru. */
function candidates(scenes: readonly ReelScene[]): Placement[] {
  const hook: Placement[] = [];
  const tension: Placement[] = [];
  const questions: Placement[] = [];
  scenes.forEach((scene, index) => {
    const text = scene.voiceover?.text;
    if (!text) return;
    if (index === 0) hook.push({ scene: index, tag: "excited", at: "start" });
    if (scene.type === "C08_UPSET") tension.push({ scene: index, tag: "whispers", at: "start" });
    if (scene.type === "M02_MONTE_CARLO" && sentences(text).length > 1) tension.push({ scene: index, tag: "short pause", at: { afterSentence: 0 } });
    sentences(text).forEach((sentence, at) => {
      if (sentence.endsWith("?")) questions.push({ scene: index, tag: "curious", at: { beforeSentence: at } });
    });
  });
  return [...hook, ...tension, ...questions];
}

/** En çok 5 etiket; videodaki sırayla art arda aynı etiket yok, sahne başına bir etiket. */
export function planTags(scenes: readonly ReelScene[]): Placement[] {
  const chosen: Placement[] = [];
  for (const candidate of candidates(scenes)) {
    if (chosen.length >= MAX_TAGS) break;
    if (chosen.some((item) => item.scene === candidate.scene)) continue;
    const ordered = [...chosen, candidate].sort((a, b) => a.scene - b.scene);
    if (ordered.some((item, at) => at > 0 && ordered[at - 1]?.tag === item.tag)) continue;
    chosen.push(candidate);
  }
  return chosen.sort((a, b) => a.scene - b.scene);
}

function applyTag(text: string, placement: Placement): string {
  const tag = `[${placement.tag}]`;
  if (placement.at === "start") return `${tag} ${text}`;
  const parts = sentences(text);
  if ("afterSentence" in placement.at) {
    const at = placement.at.afterSentence;
    return [...parts.slice(0, at + 1), tag, ...parts.slice(at + 1)].join(" ");
  }
  const at = placement.at.beforeSentence;
  return [...parts.slice(0, at), tag, ...parts.slice(at)].join(" ");
}

/** ElevenLabs'e giden sahne metinleri. Etiketsiz profilde metindeki her etiket silinir. */
export function spokenTexts(scenes: readonly ReelScene[], profile: VoiceProfile): (string | null)[] {
  const plain = scenes.map((scene) => (scene.voiceover ? pronounce(stripTags(scene.voiceover.text)) : null));
  if (!profile.tags) return plain;
  const tagged = [...plain];
  for (const placement of planTags(scenes)) {
    const text = tagged[placement.scene];
    if (text) tagged[placement.scene] = applyTag(text, placement);
  }
  return tagged;
}

export const spokenWords = (text: string): number => stripTags(text).split(/\s+/u).filter(Boolean).length;
export const estimateSeconds = (text: string, profile: VoiceProfile): number => spokenWords(text) / profile.wordsPerSecond;
