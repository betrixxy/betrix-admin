/**
 * Stadyum kart adı — TEK KAYNAK (saf). Öncelik: admin düzeltmesi (`VenueName` tablosu) → Türkçe karşılık
 * tablosu → kural → API adı. Kural (eşleşmeyen ad API adıyla yazılmaz): bilinen sözcüklerde ASCII → Türkçe
 * harf (`TURKISH_VENUE_WORDS`, yalnızca sözlükteki sözcükler — tahmin yok) + "Stadium/Stadion/Stadi/Stadı" →
 * "Stadyumu". Tabloda olmayan her ad (kural uygulansa da) raporda listelenir (Kütüphane → Ad Raporu).
 */

/**
 * API-Football ham stadyum adı → kartta yazılan Türkçe ad. Bilerek kısa: sponsorlu adlar sezonluk değişir,
 * tahminle doldurulmaz — eşleşmeyenler raporda listelenir, admin düzeltmesi `VenueName` tablosuna yazılır.
 */
export const VENUE_NAMES_TR: Readonly<Record<string, string>> = {
  "Konya Buyuksehir Belediye Stadium": "Konya Büyükşehir Stadyumu",
};

/**
 * Stadyum adlarında ASCII yazılan Türkçe sözcükler (küçük harf ASCII → doğru yazım). Yalnızca bu sözcükler
 * düzeltilir; listede olmayan sözcük olduğu gibi kalır (yabancı ad, marka). Yeni sözcük eklemek kuralı
 * bütün kartlarda düzeltir.
 */
const TURKISH_VENUE_WORDS: Readonly<Record<string, string>> = {
  arac: "Araç",
  ataturk: "Atatürk",
  basaksehir: "Başakşehir",
  besiktas: "Beşiktaş",
  buyuksehir: "Büyükşehir",
  corum: "Çorum",
  diyarbakir: "Diyarbakır",
  enerturk: "Enertürk",
  erdogan: "Erdoğan",
  eskisehir: "Eskişehir",
  fenerbahce: "Fenerbahçe",
  goztepe: "Göztepe",
  gursel: "Gürsel",
  istanbul: "İstanbul",
  izmir: "İzmir",
  kadikoy: "Kadıköy",
  kasimpasa: "Kasımpaşa",
  mumin: "Mümin",
  ozkasap: "Özkasap",
  saracoglu: "Saracoğlu",
  sanliurfa: "Şanlıurfa",
  sehir: "Şehir",
  sukru: "Şükrü",
  tupras: "Tüpraş",
  umraniye: "Ümraniye",
};

/** Sözcük sözcük Türkçe harf düzeltmesi; büyük harfle yazılmış sözcük büyük harf kalır (Türkçe kuralla). */
export function turkishVenueLetters(name: string): string {
  return name.replace(/\p{L}+/gu, (word) => {
    const fixed = TURKISH_VENUE_WORDS[word.toLowerCase()];
    if (!fixed) return word;
    return word.length > 1 && word === word.toUpperCase() ? fixed.toLocaleUpperCase("tr-TR") : fixed;
  });
}

const STADIUM_WORD = "(?:Stadium|Stadion|Stadionu|Stadi|Stadı)";

/** Ek kuralı: "… Stadium" → "… Stadyumu", "Stadium …" → "… Stadyumu", ortadaki "Stadium" → "Stadyumu". */
function stadiumSuffix(name: string): string {
  const suffix = new RegExp(`^(.+?)\\s+${STADIUM_WORD}$`, "iu").exec(name);
  if (suffix?.[1]) return `${suffix[1]} Stadyumu`;
  const prefix = new RegExp(`^${STADIUM_WORD}\\s+(.+)$`, "iu").exec(name);
  if (prefix?.[1]) return `${prefix[1]} Stadyumu`;
  return name.replace(new RegExp(`(?<=\\s)${STADIUM_WORD}(?=\\s)`, "giu"), "Stadyumu");
}

/** Kural (harf düzeltmesi + "Stadyumu" eki); hiçbir şey değişmiyorsa null. */
export function venueRule(apiName: string): string | null {
  const name = apiName.trim().replace(/\s+/gu, " ");
  const ruled = turkishVenueLetters(stadiumSuffix(name));
  return ruled === name ? null : ruled;
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

/** Raporda listelenecek mi: düzeltme/tablo eşleşmesi yoksa (kural uygulanmış olsa da admin onaylamadı). */
export const venueNeedsReview = (venue: CardVenueName) => venue.source === "rule" || venue.source === "api";
