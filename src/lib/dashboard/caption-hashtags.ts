import { MAX_HASHTAGS } from "@/lib/dashboard/caption-format";
import { COMPETITION_NAMES } from "@/lib/names/competition-names";

/**
 * Gönderi metni hashtag'leri — BÜTÜN kart türleri için tek kural (2026-10-31, canlı test: 0 hashtag'li şablonlar).
 * Instagram metni 3–5 hashtag taşır, sırası: özel etiketler (takım/oyuncu, sonra turnuva) → içerik türü →
 * marka. Kurallar:
 * - takım/oyuncu: kart adı boşluksuz, noktalama atılır, Türkçe harf korunur ("Çaykur Rizespor" → #ÇaykurRizespor);
 * - turnuva: `competition-names.ts` tablosunun KISA adı (#SüperLig, #ŞampiyonlarLigi, #SerieA) — sponsorlu uzun
 *   ad (#TrendyolSüperLig) yazılmaz; büyük harfli künye ("TRENDYOL SÜPER LİG") da tablodan çözülür, tabloda
 *   olmayan büyük harfli ad etiket olmaz;
 * - içerik türü `CONTENT_TAGS`, marka `#CheckMatch`; özel etiket yoksa `#Futbol` (en az 3 olsun diye);
 * - en fazla 5 (ortak kapı `caption-format.ts`), tekrar yok, bahis dili yok (#iddaa vb. hiçbir kaynaktan gelmez).
 * X sürümü bu satırın ilk iki etiketini + markayı alır (`x-caption.ts`).
 */

export const BRAND_TAG = "#CheckMatch";
export const FALLBACK_TAG = "#Futbol";
export const MIN_HASHTAGS = 3;

export const CONTENT_TAGS = {
  MATCH_DAY: "#MaçGünü",
  WEEKLY_FIXTURES: "#HaftanınMaçları",
  PROBABLE_LINEUPS: "#Muhtemel11",
  AI_MARKET_PREDICTION: "#MaçÖnüAnaliz",
  DRAWS_AND_PAIRINGS: "#Kura",
  MATCH_RESULT: "#MaçSonucu",
  MATCH_STATS: "#Maçİstatistikleri",
  PLAYER_SPOTLIGHT: "#MaçınOyuncusu",
  PLAYER_TOP: "#MaçınEnİyileri",
  MATCH_ANALYSIS: "#MaçAnalizi",
  PREDICTION_SCORECARD: "#TahminKarnesi",
  STANDINGS: "#PuanDurumu",
} as const;

/** Ad → hashtag: harf/rakam dışı her şey atılır, Türkçe harf korunur; tek harf/boş → null. */
export function toTag(text: string | null | undefined): string | null {
  // Baş harf atılır ("S. Mbangula" → #Mbangula): kısaltılmış kişi adı etikette okunmaz.
  const cleaned = (text ?? "").normalize("NFC").replace(/^(?:\p{Lu}\.\s*)+(?=\p{L}{2})/u, "").replace(/[^\p{L}\p{N}]+/gu, "");
  return cleaned.length > 1 ? `#${cleaned}` : null;
}

/** Karşılaştırma anahtarı: I/İ/ı farkı ve büyük/küçük harf yok sayılır ("SERIE A" = "Serie A", "SÜPER LİG" = "Süper Lig"). */
const fold = (text: string): string => text.normalize("NFC").replace(/[İIı]/gu, "i").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const isUpper = (text: string): boolean => /\p{L}/u.test(text) && text === text.toLocaleUpperCase("tr-TR");

/** Turnuva etiketi: tablodaki kısa ad (#SüperLig); tabloda yoksa adın kendisi (büyük harfliyse etiket yok). */
export function competitionTag(name: string | null | undefined): string | null {
  const value = (name ?? "").trim();
  if (!value) return null;
  const key = fold(value);
  const known = Object.values(COMPETITION_NAMES).find((entry) => fold(entry.name) === key || fold(entry.short) === key);
  if (known) return toTag(known.short);
  return isUpper(value) ? null : toTag(value);
}

interface HashtagInput {
  /** Takım / oyuncu adları — önem sırasıyla. */
  names?: (string | null | undefined)[];
  competitions?: (string | null | undefined)[];
  /** İçerik türü etiketi (`CONTENT_TAGS`); null → yalnızca özel etiketler + marka. */
  type: string | null;
}

/** 3–5 etiket: özel (ad, turnuva) → tür → marka; tekrar yok, en fazla 5. */
export function captionHashtags({ names = [], competitions = [], type }: HashtagInput): string[] {
  const fixed = [type, BRAND_TAG].filter((tag): tag is string => tag !== null);
  const specific = [...new Set([...names.map(toTag), ...competitions.map(competitionTag)].filter((tag): tag is string => tag !== null))].filter((tag) => !fixed.includes(tag));
  const picked = specific.slice(0, MAX_HASHTAGS - fixed.length);
  const filler = picked.length + fixed.length < MIN_HASHTAGS ? [FALLBACK_TAG] : [];
  return [...picked, ...filler, ...fixed];
}

/** Metnin hashtag satırı. */
export const hashtagLine = (input: HashtagInput): string => captionHashtags(input).join(" ");
