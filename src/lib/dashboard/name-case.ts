/**
 * Ad büyük harfi — ORTAK yardımcı (kurucu kararı, 2026-10-20): Türkçe büyük harf (i → İ) yalnızca
 * Türk adlarına; yabancı adlar uluslararası kuralla ("Borussia" → "BORUSSIA", "Vlahović" →
 * "VLAHOVIĆ", "İrfan Can Eğribayat" → "İRFAN CAN EĞRİBAYAT"). Yalnızca AD türündeki metinler
 * (takım, oyuncu, teknik direktör, hakem, stadyum) bu yardımcıdan geçer; arayüz etiketleri
 * ("BERABERLİK", "8. HAFTA", Türkçe lig adları) Türkçe büyük harfle kalır (`upperTr`).
 *
 * Karar sözcük sözcük:
 *  1. Yalnızca Türkçede olan harf (ı İ ğ Ğ ş Ş) ya da Türk kulüp eki ("-spor") → Türkçe.
 *  2. Türk alfabesinde olmayan harf (q w x, ć é ß ä ø ñ …) → uluslararası.
 *  3. Belirsiz sözcük (yalnızca ASCII + ç ö ü) adın diğer sözcüklerindeki işarete uyar; işaret
 *     yoksa veriden gelen ipucuna (takımın ülkesi, bkz. `team-origin.ts`); o da yoksa Türkçe
 *     (önceki davranış — ipucu olmayan çağrı yerinde gerileme olmaz).
 */

export type NameOrigin = "tr" | "intl";

const TURKISH_ONLY = /[ıİğĞşŞ]/u;
const TURKISH_CLUB_SUFFIX = /\p{L}spor$/iu;
/** Türk alfabesindeki harfler (q, w, x yok). Bunların dışındaki her harf yabancı işarettir. */
const TURKISH_ALPHABET = /^[a-pr-vyzA-PR-VYZçÇğĞıİöÖşŞüÜ]$/u;

function hasForeignLetter(word: string): boolean {
  for (const char of word) if (/\p{L}/u.test(char) && !TURKISH_ALPHABET.test(char)) return true;
  return false;
}

/** Sözcüğün kendi işareti; belirsizse null. */
export function wordOrigin(word: string): NameOrigin | null {
  if (TURKISH_ONLY.test(word)) return "tr";
  // Türk kulüp adı eki ("Trabzonspor", "Kayserispor"); "Sporting" etkilenmez.
  if (TURKISH_CLUB_SUFFIX.test(word)) return "tr";
  if (hasForeignLetter(word)) return "intl";
  return null;
}

/** Adın genel işareti (ilk işaretli sözcük); hiçbir sözcük işaretli değilse null. */
export function nameOrigin(name: string): NameOrigin | null {
  for (const word of name.split(/\s+/u)) {
    const origin = wordOrigin(word);
    if (origin) return origin;
  }
  return null;
}

const upperWith = (text: string, origin: NameOrigin) => (origin === "tr" ? text.toLocaleUpperCase("tr-TR") : text.toLocaleUpperCase("en-US"));

/** Adı büyük harfe çevirir; `hint` veriden gelen köken (ör. takımın ülkesi). */
export function upperName(name: string, hint?: NameOrigin | null): string {
  const fallback = nameOrigin(name) ?? hint ?? "tr";
  // Boşluklar korunur; her sözcük kendi işaretiyle, belirsizse adın/ipucunun kökeniyle.
  return name.replace(/\S+/gu, (word) => upperWith(word, wordOrigin(word) ?? fallback));
}

/** API-Football ülke adından köken ("Turkey" → tr); bilinmiyorsa null. */
export function originFromCountry(country: string | null | undefined): NameOrigin | null {
  if (!country) return null;
  return /^(turkey|türkiye)$/iu.test(country.trim()) ? "tr" : "intl";
}

/**
 * Takımın kökeni (bkz. `team-origin.ts`): `name` kartta yazan takım adının kökeni, `people` o
 * takımın oyuncu/teknik direktör adlarının varsayılan kökeni. Milli takım ve Türkçe karşılıkla
 * yazılan yabancı kulüp adları kartta TÜRKÇE yazılır: adın kökeni tr, kişilerin kökeni ülkeden.
 */
export interface TeamOrigin {
  name: NameOrigin | null;
  people: NameOrigin | null;
}

export const UNKNOWN_ORIGIN: TeamOrigin = { name: null, people: null };

/** Kartta Türkçe karşılığıyla yazılan yabancı kulüpler (bkz. `match-result-labels.ts::TEAM_NAMES_TR`). */
const TURKISH_EXONYMS = new Set(["Bayern Münih", "Marsilya", "Kızılyıldız"]);

/** Kartta yazan takım adının kökeni: Türkçe karşılık ise tr, değilse takımın kökeni. */
export function teamNameOrigin(cardName: string, origin: TeamOrigin | undefined): NameOrigin | null {
  return TURKISH_EXONYMS.has(cardName.trim()) ? "tr" : (origin?.name ?? null);
}

/** Takım adını büyütür (kartın takım adı). */
export const upperTeamName = (cardName: string, origin: TeamOrigin | undefined): string => upperName(cardName, teamNameOrigin(cardName, origin));
