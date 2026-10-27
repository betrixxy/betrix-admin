import { OFFICIAL_COMPETITION_NAMES, teamNameTr } from "@/lib/dashboard/match-result-labels";

/**
 * Fotoğraf arşivinin isim disiplini — saf, tek kaynak. Lig, takım ve kişi adları API-Football +
 * resmi ad tablolarından türetilir; elle yazılan serbest klasör adı yoktur (kişide yalnızca admin
 * "resmi adı düzelt" ile `nameOverride` verebilir).
 */

/** "Milli Takımlar" kökü — sanal lig (API-Football'da karşılığı yok). */
export const NATIONAL_ROOT_ID = 0;
export const NATIONAL_ROOT_NAME = "Milli Takımlar";

/**
 * Kulüp adları — anahtar API-Football takım kimliği (`club-colors.ts` ile aynı).
 *
 *   - `archiveName`: arşiv klasörünün adı — resmi kısa ad, SPONSORSUZ ("Beşiktaş JK"; sponsorlu
 *     adlar sezonluk değişir, arşivde kullanılmaz).
 *   - Kart adı (`displayName`) buraya YAZILMAZ: kartlar mevcut Türkçe eşleme tablosunu kullanmaya
 *     devam eder (`teamNameTr(apiName)` → "Beşiktaş"); tek kaynak orası.
 *   - `apiName`: API-Football'un döndürdüğü ad (2026-10-19) — kart adı bununla türetilir.
 *   - `verified: false`: resmi kısa ad kullanıcı onayı bekliyor.
 *
 * Kaynak (2026-10-19): TFF kulüp bilgi sayfalarındaki tescilli ad, sponsor ön eki atılıp kısaltılmış
 * ("… Spor Kulübü" → SK, "… Futbol Kulübü" → FK). TFF'nin dernek yerine futbol şirketini (A.Ş.)
 * listelediği kulüplerde (Göztepe, Fatih Karagümrük) "SK" kullanıcı onaylı; Amed "Sportif Faaliyetler
 * Kulübü" → SFK (kısaltma kuralıyla tutarlı, kullanıcı onaylı). Tüm satırlar onaylı (2026-10-19).
 *
 * Tabloda olmayan takım: Türkçe eşleme → API adı.
 */
export interface TeamNameEntry {
  archiveName: string;
  apiName: string;
  verified: boolean;
}

const team = (archiveName: string, apiName: string, verified = true): TeamNameEntry => ({ archiveName, apiName, verified });

export const ARCHIVE_TEAM_NAMES: Readonly<Record<number, TeamNameEntry>> = {
  // ---- Trendyol Süper Lig 2026-27 (18) ----
  996: team("Alanyaspor", "Alanyaspor"),
  3579: team("Amed SFK", "Amed"),
  564: team("İstanbul Başakşehir FK", "Başakşehir"),
  549: team("Beşiktaş JK", "Beşiktaş"),
  6343: team("Çorum FK", "Çorum FK"),
  1009: team("Erzurumspor FK", "Erzurumspor FK"),
  3588: team("Eyüpspor", "Eyüpspor"),
  611: team("Fenerbahçe SK", "Fenerbahçe"),
  645: team("Galatasaray SK", "Galatasaray"),
  3573: team("Gaziantep FK", "Gaziantep FK"),
  997: team("Gençlerbirliği SK", "Gençlerbirliği S.K."),
  994: team("Göztepe SK", "Göztepe"),
  1004: team("Kasımpaşa SK", "Kasımpaşa"),
  7411: team("Kocaelispor", "Kocaelispor"),
  607: team("Konyaspor", "Konyaspor"),
  1007: team("Çaykur Rizespor", "Rizespor"),
  3603: team("Samsunspor", "Samsunspor"),
  998: team("Trabzonspor", "Trabzonspor"),
  // ---- Trendyol 1. Lig 2026-27 (20) ----
  1005: team("Antalyaspor", "Antalyaspor"),
  3584: team("Bandırmaspor", "Bandırmaspor"),
  7395: team("Batman Petrolspor", "Batman Petrolspor"),
  3583: team("Bodrum FK", "Bodrum FK"),
  3569: team("Boluspor", "Boluspor"),
  1003: team("Bursaspor", "Bursaspor"),
  7402: team("Esenler Erokspor", "Esenler Erokspor"),
  3589: team("Fatih Karagümrük SK", "Fatih Karagümrük"),
  17259: team("Iğdır FK", "Iğdır FK"),
  3578: team("İstanbulspor", "İstanbulspor"),
  1001: team("Kayserispor", "Kayserispor"),
  3595: team("Ankara Keçiörengücü", "Keçiörengücü"),
  3597: team("Manisa FK", "Manisa F.K."),
  6533: team("Mardin 1969 Spor", "Mardin 1969"),
  7414: team("Muğlaspor", "Muğlaspor"),
  3601: team("Pendikspor", "Pendikspor"),
  3605: team("Sarıyer", "Sarıyer"),
  1002: team("Sivasspor", "Sivasspor"),
  3577: team("Ümraniyespor", "Ümraniyespor"),
  6342: team("Vanspor FK", "Vanspor FK"),
  // ---- Milli takım ----
  777: team("Türkiye", "Turkey"),
  // ---- Avrupa kupalarında sık rakipler ----
  167: team("TSG Hoffenheim", "1899 Hoffenheim"),
};

/** Lig resmi adı: tablo (`OFFICIAL_COMPETITION_NAMES`) → API adı. */
export function officialLeagueName(leagueId: number, apiName: string): string {
  if (leagueId === NATIONAL_ROOT_ID) return NATIONAL_ROOT_NAME;
  return OFFICIAL_COMPETITION_NAMES[leagueId] ?? apiName;
}

/** Arşiv klasörü adı: arşiv tablosu (sponsorsuz resmi kısa ad) → Türkçe eşleme → API adı. */
export function officialTeamName(teamId: number, apiName: string): string {
  return ARCHIVE_TEAM_NAMES[teamId]?.archiveName ?? teamNameTr(apiName);
}

/**
 * Avrupa takımlarının Türk yayıncı kullanımı (kart adı) — API adı → ekranda okunan ad. Büyük harf
 * yabancı adlarda uluslararası kuralla (`name-case.ts`). Admin stüdyoda kart başına düzeltebilir.
 */
export const EUROPEAN_TEAM_NAMES_TR: Readonly<Record<string, string>> = {
  "AS Roma": "Roma",
  "Atletico Madrid": "Atletico Madrid",
  "Lask Linz": "LASK",
  "Shakhtar Donetsk": "Şahtar Donetsk",
  "Slavia Praha": "Slavia Prag",
  "Sparta Praha": "Sparta Prag",
  "VfB Stuttgart": "Stuttgart",
  "AEK Athens FC": "AEK",
  "Olympiakos Piraeus": "Olympiakos",
  "Panathinaikos": "Panathinaikos",
  "PSV Eindhoven": "PSV",
  "Club Brugge KV": "Club Brugge",
  "Union St. Gilloise": "Union Saint-Gilloise",
  "Omonia Nicosia": "Omonia",
  "Heart Of Midlothian": "Hearts",
  "SC Freiburg": "Freiburg",
  "FK Jablonec": "Jablonec",
  "FK Crvena Zvezda": "Kızılyıldız",
  "Dinamo Zagreb": "Dinamo Zagreb",
  "Manchester United": "Manchester United",
  "Manchester City": "Manchester City",
  "Tottenham": "Tottenham",
  "Atalanta": "Atalanta",
  "Benfica": "Benfica",
  "FC Porto": "Porto",
  "Sporting Braga": "Braga",
  "Borussia Monchengladbach": "Borussia Mönchengladbach",
  "Hapoel Beer Sheva": "Hapoel Beer Sheva",
  "Celtic": "Celtic",
  "Rangers": "Rangers",
  "FC Copenhagen": "Kopenhag",
  "Young Boys": "Young Boys",
  "Red Bull Salzburg": "Salzburg",
};

/** Kartlardaki kısa ad: Avrupa yayıncı adı → Türkçe eşleme (`teamNameTr`) → API adı. Arşiv tablosu kartı etkilemez. */
export function cardTeamName(apiName: string): string {
  return EUROPEAN_TEAM_NAMES_TR[apiName.trim()] ?? teamNameTr(apiName);
}

const ABBREVIATED = /^(\p{Lu})\.\s*(.+)$/u;

/**
 * Kişi resmi tam adı. API kadrosu adı kısaltır ("O. Kökçü"); sezon oyuncu verisindeki ad
 * ("Orkun" ya da "Mehmet Orkun") içinden aynı harfle başlayan sözcükle açılır → "Orkun Kökçü".
 * Soyadı API'nin bilinen yazımıyla kalır. Kısaltma yoksa ("Vinícius Júnior") API adı olduğu gibi.
 */
export function officialPersonName(apiName: string, firstname: string | null | undefined, lastname: string | null | undefined): string {
  const name = apiName.trim();
  const match = ABBREVIATED.exec(name);
  if (!match) return name || [firstname, lastname].filter(Boolean).join(" ").trim();
  const [, initial = "", surname = ""] = match;
  const words = (firstname ?? "").split(/\s+/).filter(Boolean);
  const given = words.find((word) => word.toLocaleUpperCase("tr-TR").startsWith(initial.toLocaleUpperCase("tr-TR")));
  if (given) return `${given} ${surname}`;
  const first = words[0];
  return first ? `${first} ${lastname?.trim() || surname}` : name;
}

/** Ekranda gösterilen ad: admin düzeltmesi her zaman kazanır. */
export function displayPersonName(person: { officialName: string; nameOverride: string | null }): string {
  return person.nameOverride?.trim() || person.officialName;
}

/** tr-TR alfabetik karşılaştırma (Ç, Ğ, İ, Ö, Ş, Ü doğru yerde). */
export const compareTr = (a: string, b: string): number => a.localeCompare(b, "tr-TR", { sensitivity: "base" });

/** Elle eklenen kişi (API-Football'da bulunamayan teknik direktör) negatif kimlik taşır — senkron ona dokunmaz. */
export const isManualPerson = (apiId: number): boolean => apiId < 0;

/**
 * Elle girilen kişi adı — resmi ad kuralı: tam ad (kısaltma "V. Italiano" kabul edilmez), fazla boşluk
 * temizlenir, 3–80 karakter. Geçersizse null; ad sonradan "resmi adı düzelt" ile değiştirilebilir.
 */
export function manualPersonName(input: string): string | null {
  const name = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 80 || !/\p{L}/u.test(name)) return null;
  if (ABBREVIATED.test(name) || /(^|\s)\p{Lu}\.(\s|$)/u.test(name)) return null;
  return name;
}
