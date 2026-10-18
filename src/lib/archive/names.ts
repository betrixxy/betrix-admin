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
 * Kulüplerin resmi tam adları — anahtar API-Football takım kimliği (`club-colors.ts` ile aynı).
 * Tabloda olmayan takım: Türkçe eşleme (`TEAM_NAMES_TR`) → API adı. Sponsor değişirse yalnızca
 * burası güncellenir.
 */
export const OFFICIAL_TEAM_NAMES: Readonly<Record<number, string>> = {
  // Trendyol Süper Lig 2026-27
  549: "Beşiktaş JK",
  645: "Galatasaray SK",
  611: "Fenerbahçe SK",
  998: "Trabzonspor",
  564: "İstanbul Başakşehir FK",
  607: "Konyaspor",
  994: "Göztepe SK",
  996: "Alanyaspor",
  997: "Gençlerbirliği SK",
  1004: "Kasımpaşa SK",
  1007: "Çaykur Rizespor",
  1009: "Erzurumspor FK",
  3573: "Gaziantep FK",
  3579: "Amed SK",
  3588: "Eyüpspor",
  3603: "Samsunspor",
  6343: "Çorum FK",
  7411: "Kocaelispor",
  // Milli takım
  777: "Türkiye",
  // Avrupa kupalarında sık rakipler
  167: "TSG Hoffenheim",
};

/** Lig resmi adı: tablo (`OFFICIAL_COMPETITION_NAMES`) → API adı. */
export function officialLeagueName(leagueId: number, apiName: string): string {
  if (leagueId === NATIONAL_ROOT_ID) return NATIONAL_ROOT_NAME;
  return OFFICIAL_COMPETITION_NAMES[leagueId] ?? apiName;
}

/** Takım resmi adı: resmi tablo → Türkçe eşleme → API adı. */
export function officialTeamName(teamId: number, apiName: string): string {
  return OFFICIAL_TEAM_NAMES[teamId] ?? teamNameTr(apiName);
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
