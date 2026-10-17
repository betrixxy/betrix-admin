import { roundLabel } from "@/lib/services/api-football/weekly-mappers";
import type { CompetitionKind, MatchImportance } from "@/types/match-result";

/**
 * Maç Sonucu kartının Türkçe etiketleri — saf fonksiyonlar. Turnuva türü API-Football league
 * id'sinden türetilir (formda salt okunur); maç önemi admin seçimidir.
 */

const KIND_BY_LEAGUE_ID: Record<number, CompetitionKind> = {
  203: "SUPER_LIG",
  2: "UCL",
  3: "UEL",
  848: "UECL",
  206: "TR_CUP",
  // Milli takım turnuvaları: Dünya Kupası (+ Avrupa elemeleri), EURO (+ elemeler), Uluslar Ligi, hazırlık maçları.
  1: "NATIONAL",
  32: "NATIONAL",
  4: "NATIONAL",
  960: "NATIONAL",
  5: "NATIONAL",
  10: "NATIONAL",
};

export const COMPETITION_LABELS: Record<CompetitionKind, string> = {
  SUPER_LIG: "Süper Lig",
  UCL: "Şampiyonlar Ligi",
  UEL: "Avrupa Ligi",
  UECL: "Konferans Ligi",
  TR_CUP: "Türkiye Kupası",
  NATIONAL: "Milli Maç",
  OTHER: "Diğer",
};

export const MATCH_IMPORTANCE_LABELS: Record<MatchImportance, string> = {
  NORMAL: "Normal",
  DERBY: "Derbi",
  BIG_DERBY: "Büyük derbi",
  FINAL_CRITICAL: "Final / kritik",
};

export function competitionKind(leagueId: number): CompetitionKind {
  return KIND_BY_LEAGUE_ID[leagueId] ?? "OTHER";
}

/** Kartta yazan turnuva adı: eşlenmiş turnuvada Türkçe ad, "Diğer"de sağlayıcının adı. */
export function competitionName(kind: CompetitionKind, providerName: string): string {
  if (kind === "OTHER" || kind === "NATIONAL") return providerName;
  return kind === "UCL" || kind === "UEL" || kind === "UECL" ? `UEFA ${COMPETITION_LABELS[kind]}` : COMPETITION_LABELS[kind];
}

/** Maç sonrası tur etiketi: Avrupa lig aşamasında "Lig Aşaması · 2. Maç"; diğerleri ortak tablodan. */
export function resultRoundLabel(round: string): string {
  const leagueStage = /^League Stage - (\d+)$/.exec(round);
  if (leagueStage) return `Lig Aşaması · ${leagueStage[1]}. Maç`;
  return roundLabel(round);
}

/** API-Football'un ASCII/İngilizce takım adları → Türkçe yazımı. Listede olmayan ad olduğu gibi kalır. */
const TEAM_NAMES_TR: Record<string, string> = {
  Besiktas: "Beşiktaş",
  Fenerbahce: "Fenerbahçe",
  Basaksehir: "Başakşehir",
  "Istanbul Basaksehir": "Başakşehir",
  Goztepe: "Göztepe",
  Kasimpasa: "Kasımpaşa",
  Eyupspor: "Eyüpspor",
  Genclerbirligi: "Gençlerbirliği",
  "Fatih Karagumruk": "Fatih Karagümrük",
  Karagumruk: "Fatih Karagümrük",
  Rizespor: "Çaykur Rizespor",
  "Erzurumspor FK": "Erzurumspor",
  Istanbulspor: "İstanbulspor",
  Bandirmaspor: "Bandırmaspor",
  "Corum FK": "Çorum FK",
  "Igdir FK": "Iğdır FK",
  Keciorengucu: "Keçiörengücü",
  Umraniyespor: "Ümraniyespor",
  Turkey: "Türkiye",
  "1899 Hoffenheim": "Hoffenheim",
  "Bayern Munich": "Bayern Münih",
  "Bayer Leverkusen": "Leverkusen",
  "Borussia Dortmund": "Dortmund",
  "Eintracht Frankfurt": "Frankfurt",
  "Paris Saint Germain": "PSG",
  "Inter Milan": "Inter",
  "AC Milan": "Milan",
  Marseille: "Marsilya",
  "Sporting CP": "Sporting",
  "Red Star Belgrade": "Kızılyıldız",
  "FC Midtjylland": "Midtjylland",
  Germany: "Almanya",
  Spain: "İspanya",
  Italy: "İtalya",
  France: "Fransa",
  England: "İngiltere",
  Netherlands: "Hollanda",
  Portugal: "Portekiz",
  Croatia: "Hırvatistan",
  Georgia: "Gürcistan",
};

export function teamNameTr(name: string): string {
  return TEAM_NAMES_TR[name.trim()] ?? name.trim();
}

export function upperTr(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}
