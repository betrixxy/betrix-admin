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
 *  4. Harfleri ASCII'ye katlanmış ad (yalnızca ASCII, hem büyük "I" hem küçük "i"): Türkçe büyük harf
 *     karışık sözcük üretir ("M. Ibrahimoglu" → "IBRAHİMOGLU", 2026-10-30) — katlanmada "İ" mi "I" mı
 *     olduğu bilinemez, sözcük TUTARLI uluslararası kuralla büyür ("IBRAHIMOGLU"). Harfler Sportmonks /
 *     arşivden geri yüklenebildiyse ("İbrahimoğlu") ad zaten Türkçe işaret taşır, bu kural devreye girmez.
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

/** ASCII'ye katlanmış, Türkçe büyük harfte karışık I/İ verecek sözcük (kural 4). */
const ASCII_WORD = /^[\x20-\x7e]+$/u;
export const isFoldedMixedI = (word: string): boolean => ASCII_WORD.test(word) && word.includes("I") && word.includes("i");

const upperWith = (text: string, origin: NameOrigin) => (origin === "tr" ? text.toLocaleUpperCase("tr-TR") : text.toLocaleUpperCase("en-US"));

/** Adı büyük harfe çevirir; `hint` veriden gelen köken (ör. takımın ülkesi). */
export function upperName(name: string, hint?: NameOrigin | null): string {
  const fallback = nameOrigin(name) ?? hint ?? "tr";
  // Boşluklar korunur; her sözcük kendi işaretiyle, belirsizse adın/ipucunun kökeniyle.
  return name.replace(/\S+/gu, (word) => upperWith(word, wordOrigin(word) ?? (isFoldedMixedI(word) ? "intl" : fallback)));
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

/** Kartta Türkçe karşılığıyla yazılan yabancı kulüpler (bkz. `archive/names.ts::TEAM_NAMES_TR`). */
const TURKISH_EXONYMS = new Set(["Bayern Münih", "Marsilya", "Kızılyıldız", "Dinamo Kiev", "Rapid Viyana", "Austria Viyana", "Karabağ", "Neftçi"]);

/** Kartta yazan takım adının kökeni: Türkçe karşılık ise tr, değilse takımın kökeni. */
export function teamNameOrigin(cardName: string, origin: TeamOrigin | undefined): NameOrigin | null {
  return TURKISH_EXONYMS.has(cardName.trim()) ? "tr" : (origin?.name ?? null);
}

/** Takım adını büyütür (kartın takım adı). */
export const upperTeamName = (cardName: string, origin: TeamOrigin | undefined): string => upperName(cardName, teamNameOrigin(cardName, origin));

/**
 * Lig / turnuva adı da AD gibi büyür (kurucu kararı 2026-10-29): Türkçe ad Türkçe büyük harfle ("Trendyol Süper
 * Lig" → "TRENDYOL SÜPER LİG", "Ziraat Türkiye Kupası"), yabancı ad uluslararası kuralla ("Serie A" →
 * "SERIE A", "LaLiga" → "LALIGA", "Bundesliga" → "BUNDESLIGA"). Türkçe sayılan: Türkçeye özgü harf
 * (ı İ ğ Ğ ş Ş) ya da Türkçe turnuva sözcüğü (Lig, Ligi, Kupa(sı), Süper, Avrupa…). Sözcük sözcük değil,
 * adın tamamı tek kökenle büyür ("Premier Lig" Türkçe ad → "PREMİER LİG").
 */
const TURKISH_COMPETITION_WORD = /(^|[\s.·/-])(lig|ligi|kupa|kupası|süper|avrupa|konferans|şampiyonlar|uluslar|türkiye|milli|hazırlık|turnuvası|aşaması)(?=$|[\s.·/-])/iu;

export function competitionOrigin(name: string): NameOrigin {
  return TURKISH_ONLY.test(name) || TURKISH_COMPETITION_WORD.test(name) ? "tr" : "intl";
}

export const upperCompetition = (name: string): string => upperWith(name, competitionOrigin(name));

/**
 * " · " ile ayrılmış künye satırı (ör. Muhtemel 11 "Serie A · 30.10 · 20:00"): her parça kendi kökeniyle —
 * lig adı yukarıdaki kural, Türkçe etiketler ("10. Hafta") Türkçe, tarih/saat etkilenmez.
 */
export const upperLabelLine = (line: string): string => line.split(" · ").map(upperCompetition).join(" · ");
