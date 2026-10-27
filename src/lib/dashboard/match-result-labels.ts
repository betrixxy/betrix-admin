import { roundLabel } from "@/lib/services/api-football/weekly-mappers";
import type { CompetitionKind } from "@/types/match-result";

/**
 * Maç Sonucu kartının Türkçe etiketleri — saf fonksiyonlar. Turnuva türü API-Football league
 * id'sinden türetilir (formda salt okunur).
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

export function competitionKind(leagueId: number): CompetitionKind {
  return KIND_BY_LEAGUE_ID[leagueId] ?? "OTHER";
}

/**
 * Kartta (künye satırı) yazan RESMİ görünen ad — sponsorlu adlar dahil, API-Football league id
 * anahtarlı. Sponsor adı değişirse yalnızca bu tablo güncellenir. Tabloda olmayan turnuvada
 * Türkçe tür adı, o da yoksa sağlayıcının adı.
 */
export const OFFICIAL_COMPETITION_NAMES: Readonly<Record<number, string>> = {
  203: "Trendyol Süper Lig",
  204: "Trendyol 1. Lig",
  206: "Ziraat Türkiye Kupası",
  2: "UEFA Şampiyonlar Ligi",
  3: "UEFA Avrupa Ligi",
  848: "UEFA Konferans Ligi",
  // Avrupa ligleri — fotoğraf arşivinde yabancı takımlar kendi liglerinin altında (bkz. lib/archive/names.ts).
  39: "Premier League",
  140: "LaLiga",
  135: "Serie A",
  78: "Bundesliga",
  61: "Ligue 1",
};

/** Kartta yazan turnuva adı: resmi ad tablosu > eşlenmiş Türkçe ad > sağlayıcının adı. */
export function competitionName(leagueId: number, kind: CompetitionKind, providerName: string): string {
  const official = OFFICIAL_COMPETITION_NAMES[leagueId];
  if (official) return official;
  if (kind === "OTHER" || kind === "NATIONAL") return providerName;
  return kind === "UCL" || kind === "UEL" || kind === "UECL" ? `UEFA ${COMPETITION_LABELS[kind]}` : COMPETITION_LABELS[kind];
}

/** Maç sonrası tur etiketi: Avrupa lig aşamasında "Lig Aşaması · 2. Maç"; diğerleri ortak tablodan. */
export function resultRoundLabel(round: string): string {
  const leagueStage = /^League Stage - (\d+)$/.exec(round);
  if (leagueStage) return `Lig Aşaması · ${leagueStage[1]}. Maç`;
  return roundLabel(round);
}

export function upperTr(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}
