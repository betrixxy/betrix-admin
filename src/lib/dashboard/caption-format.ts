import type { PublishPlatform } from "@/types/publishing";

/**
 * Gönderi metni biçim kapısı — BÜTÜN içerik türleri için tek kaynak (kurucu kararı, 2026-10-30). Bahis dili
 * kapısının (`content-language.ts::contentLanguageGate`) içinden çağrılır; böylece üretim (her motor), onay
 * (`approval.ts`) ve yayın (`publish-engine.ts`) aynı kuralı paylaşır, yeni motor kapıyı çağırınca devralır:
 * - doldurulmamış şablon alanı (`{xG}`, `{N}`) kalmaz;
 * - en fazla 5 hashtag (Instagram kuralı her yerde; X'in 2-3'ü yalnızca öneridir);
 * - X'e giden metinde link YOK — çıplak alan adı da link sayılır (X "checkmatch.net"i kendiliğinden bağlar).
 *   Platformu belli olmayan (şablon/taslak) metin X'e de gidebileceği için aynı kurala uyar; Instagram
 *   seçilmiş metinde link engel değildir (tıklanmaz, Yayın Merkezi önermez).
 */

export const MAX_HASHTAGS = 5;

/** Metindeki hashtag sayısı (satır başı ya da boşluktan sonra gelen `#…`). */
export const hashtagCount = (caption: string): number => (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

/** Şablondan sızan alan: `{xG}`, `{N}`, `{takım}` — süslü parantez içinde boşluksuz kısa ad. */
const PLACEHOLDER = /\{[^{}\s]{1,40}\}/gu;

export const unfilledPlaceholders = (text: string): string[] => [...new Set(text.match(PLACEHOLDER) ?? [])];

/** Bağlantı: http(s), www., kısa link yolu ya da çıplak alan adı ("checkmatch.net'te", "betrix.pro/r/x"). */
const LINK = /https?:\/\/|\bwww\.|\b[\p{L}\p{N}-]+\.(?:com|net|org|pro|io|co|tr|ly|gg|tv|app)\b/iu;

export const hasLinkOrDomain = (text: string): boolean => LINK.test(text);

/** Marka anışı alan adı olmadan: "tamamı checkmatch.net'te" → "tamamı CheckMatch'te" (kart görselindeki metin aynen kalır). */
export const siteMentionFree = (text: string): string => text.replace(/\bcheckmatch\.net\b/giu, "CheckMatch");

/** Gönderi metninin biçim sorunu (okunur Türkçe sebep) ya da null. `platform` null → platformdan bağımsız metin. */
export function captionFormatGate(caption: string, platform: PublishPlatform | null = null): string | null {
  const placeholders = unfilledPlaceholders(caption);
  if (placeholders.length > 0) return `Gönderi metninde doldurulmamış şablon alanı: ${placeholders.join(", ")}`;
  const tags = hashtagCount(caption);
  if (tags > MAX_HASHTAGS) return `Gönderi metninde en fazla ${MAX_HASHTAGS} hashtag olabilir (${tags} var)`;
  if ((platform === null || platform === "X") && hasLinkOrDomain(caption)) {
    return platform === "X" ? "X metninde link ya da alan adı olamaz" : "Gönderi metninde link ya da alan adı olamaz (metin X'e de gider)";
  }
  return null;
}
