/**
 * Stadyum kart adı — TEK KAYNAK (saf). Öncelik: admin düzeltmesi (`VenueName` tablosu) → Türkçe karşılık
 * tablosu → kural ("… Stadium" → "… Stadyumu") → API adı. Tabloda olmayan ad raporda listelenir
 * (Kütüphane → Ad Raporu) — kural yalnızca son eki çevirir, ASCII harfleri tahmin etmez.
 */

/**
 * API-Football ham stadyum adı → kartta yazılan Türkçe ad. Bilerek kısa: sponsorlu adlar sezonluk değişir,
 * tahminle doldurulmaz — eşleşmeyenler raporda listelenir, admin düzeltmesi `VenueName` tablosuna yazılır.
 */
export const VENUE_NAMES_TR: Readonly<Record<string, string>> = {
  "Konya Buyuksehir Belediye Stadium": "Konya Büyükşehir Stadyumu",
};

/** "… Stadium" / "… Stadion" / "Stadium …" → "… Stadyumu" (yalnızca ek; harfler olduğu gibi). */
export function venueRule(apiName: string): string | null {
  const name = apiName.trim().replace(/\s+/gu, " ");
  const suffix = /^(.+?)\s+(Stadium|Stadion|Stadionu)$/iu.exec(name);
  if (suffix?.[1]) return `${suffix[1]} Stadyumu`;
  const prefix = /^(Stadium|Stadion)\s+(.+)$/iu.exec(name);
  if (prefix?.[2]) return `${prefix[2]} Stadyumu`;
  return null;
}

export type VenueNameSource = "override" | "table" | "rule" | "api";

export interface CardVenueName {
  name: string;
  source: VenueNameSource;
}

export function cardVenueName(apiName: string, overrides: ReadonlyMap<string, string> = new Map()): CardVenueName {
  const key = apiName.trim();
  const override = overrides.get(key)?.trim();
  if (override) return { name: override, source: "override" };
  const table = VENUE_NAMES_TR[key];
  if (table) return { name: table, source: "table" };
  const rule = venueRule(key);
  if (rule) return { name: rule, source: "rule" };
  return { name: key, source: "api" };
}

/** Raporda listelenecek mi: düzeltme/tablo eşleşmesi yoksa (kural uygulanmış olsa da ASCII harf kalabilir). */
export const venueNeedsReview = (venue: CardVenueName) => venue.source === "rule" || venue.source === "api";
