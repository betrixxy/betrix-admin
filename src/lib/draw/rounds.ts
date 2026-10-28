import type { DrawStage } from "@/types/draw";

/**
 * Kura stüdyosunun turnuva ve tur kataloğu — saf, istemcide de çalışır. Tur etiketi kartta (künye) ve
 * kayıtta yazılır; `apiRound` kura sonrası API fikstürünü (API-Football `league.round`) bu tura süzer.
 */

export const DRAW_COMPETITIONS = [
  { id: 2, name: "UEFA Şampiyonlar Ligi", short: "Şampiyonlar Ligi" },
  { id: 3, name: "UEFA Avrupa Ligi", short: "Avrupa Ligi" },
  { id: 848, name: "UEFA Konferans Ligi", short: "Konferans Ligi" },
] as const;
export type DrawCompetitionId = (typeof DRAW_COMPETITIONS)[number]["id"];
/** Doğrudan açılışta (AI İçerik Stüdyosu / menü) seçili turnuva: Şampiyonlar Ligi. */
export const DEFAULT_DRAW_COMPETITION_ID: DrawCompetitionId = 2;

export interface DrawRoundDef {
  id: string;
  label: string;
  stage: DrawStage;
  /** API-Football tur adı deseni (kaynak: `league.round`, 2026-10). */
  apiRound: RegExp;
}

export const DRAW_ROUNDS: readonly DrawRoundDef[] = [
  { id: "Q2", label: "2. Ön Eleme Turu", stage: "KNOCKOUT", apiRound: /^2nd Qualifying Round$/i },
  { id: "Q3", label: "3. Ön Eleme Turu", stage: "KNOCKOUT", apiRound: /^3rd Qualifying Round$/i },
  { id: "QPO", label: "Play-Off Turu", stage: "KNOCKOUT", apiRound: /^Play-offs?$/i },
  { id: "LEAGUE", label: "Lig Aşaması", stage: "LEAGUE_PHASE", apiRound: /League Stage|League Phase/i },
  { id: "KPO", label: "Son 16 Play-Off Turu", stage: "KNOCKOUT", apiRound: /Knockout Round Play-offs/i },
  { id: "R16", label: "Son 16 Turu", stage: "KNOCKOUT", apiRound: /^Round of 16$/i },
  { id: "QF", label: "Çeyrek Final", stage: "KNOCKOUT", apiRound: /^Quarter-finals$/i },
  { id: "SF", label: "Yarı Final", stage: "KNOCKOUT", apiRound: /^Semi-finals$/i },
];

export const drawRound = (id: string): DrawRoundDef | undefined => DRAW_ROUNDS.find((round) => round.id === id);
export const drawRoundByLabel = (label: string): DrawRoundDef | undefined => DRAW_ROUNDS.find((round) => round.label === label);
export const drawCompetition = (id: number) => DRAW_COMPETITIONS.find((competition) => competition.id === id);

/**
 * Maç Merkezi'nden açılış: maçın API-Football ligi (`league.id` + `league.season`) bir kura turnuvasıysa
 * stüdyo o turnuva ve sezonla açılır; yurt içi lig vb. → null (varsayılan turnuva).
 */
export function drawSetupForLeague(league: { id: number; season: number }): { competitionId: DrawCompetitionId; season: number } | null {
  const competition = drawCompetition(league.id);
  return competition ? { competitionId: competition.id, season: league.season } : null;
}

/** Sezon başlangıç yılı → "2026/27". */
export const seasonText = (season: number) => `${season}/${String((season + 1) % 100).padStart(2, "0")}`;

/**
 * Kaydın `AiContent.fixtureId` yer tutucusu — gerçek maç kimliği değildir; aynı kura (turnuva · sezon · tur)
 * planlanmış placeholder'ı devralır.
 */
export const drawRecordKey = (competitionId: number, season: number, roundId: string) => `draw:${competitionId}:${season}:${roundId}`;
