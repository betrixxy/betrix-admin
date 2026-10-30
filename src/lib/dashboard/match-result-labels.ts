import { COMPETITION_NAMES, competitionCardName } from "@/lib/names/competition-names";
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

const short = (leagueId: number) => COMPETITION_NAMES[leagueId]?.short ?? "";

/** Turnuva türünün kısa Türkçe adı — lig adları tek kaynaktan (`competition-names.ts`). */
export const COMPETITION_LABELS: Record<CompetitionKind, string> = {
  SUPER_LIG: short(203),
  UCL: short(2),
  UEL: short(3),
  UECL: short(848),
  TR_CUP: short(206),
  NATIONAL: "Milli Maç",
  OTHER: "Diğer",
};

export function competitionKind(leagueId: number): CompetitionKind {
  return KIND_BY_LEAGUE_ID[leagueId] ?? "OTHER";
}

/** Kartta yazan turnuva adı: tek tablo (`competition-names.ts`) > eşlenmiş Türkçe tür adı > sağlayıcının adı. */
export function competitionName(leagueId: number, kind: CompetitionKind, providerName: string): string {
  if (COMPETITION_NAMES[leagueId]) return competitionCardName(leagueId, providerName);
  if (kind === "OTHER" || kind === "NATIONAL") return providerName;
  return kind === "UCL" || kind === "UEL" || kind === "UECL" ? `UEFA ${COMPETITION_LABELS[kind]}` : COMPETITION_LABELS[kind];
}

/** Maç sonrası tur etiketi: Avrupa lig aşamasında "Lig Aşaması · 2. Maç"; diğerleri ortak tablodan. */
export function resultRoundLabel(round: string): string {
  const leagueStage = /^League Stage - (\d+)$/.exec(round);
  if (leagueStage) return `Lig Aşaması · ${leagueStage[1]}. Maç`;
  return roundLabel(round);
}

/**
 * Maç Günü künyesinin tur etiketi (maç öncesi): lig "3. Hafta"; Avrupa lig aşaması, grup ve uluslar ligi
 * maç günü "3. Maç"; eleme turları ortak Türkçe tablodan ("Çeyrek Final", "Son 16 Turu", "Play-off Turu").
 */
export function matchDayRoundLabel(round: string | null | undefined): string {
  if (!round) return "";
  const regular = /^Regular Season - (\d+)$/.exec(round);
  if (regular) return `${regular[1]}. Hafta`;
  const known = roundLabel(round);
  // Lig/grup aşaması ("Lig Aşaması · 3. Maç Günü") Maç Günü künyesinde kısa: "3. Maç".
  const stageDay = /(\d+)\. Maç Günü$/u.exec(known)?.[1];
  if (stageDay) return `${stageDay}. Maç`;
  if (known !== round) return known;
  const matchday = /-\s*(\d{1,2})$/.exec(round);
  return matchday ? `${matchday[1]}. Maç` : round;
}

export function upperTr(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}
