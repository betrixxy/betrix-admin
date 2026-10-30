import { buildDraftCaption } from "@/lib/dashboard/draft-caption";
import { buildLineupCaption } from "@/lib/dashboard/lineup-caption";
import { buildMatchAnalysisCaption } from "@/lib/dashboard/match-analysis-caption";
import { buildMatchDayCaption } from "@/lib/dashboard/match-day-caption";
import { buildMatchResultCaption } from "@/lib/dashboard/match-result-caption";
import { buildMatchStatsCaption } from "@/lib/dashboard/match-stats-caption";
import { buildH2HCaption } from "@/lib/dashboard/player-h2h-caption";
import { buildSpotlightCaption, buildTopPlayersCaption } from "@/lib/dashboard/player-stats-caption";
import { buildMatchScorecardCaption, buildPeriodScorecardCaption } from "@/lib/dashboard/prediction-scorecard-caption";
import { standingsCaption } from "@/lib/dashboard/standings-layout";
import { buildVitrinCaption } from "@/lib/dashboard/vitrin-caption";
import { weeklyCaption } from "@/lib/dashboard/weekly-fixtures-layout";
import { buildDrawCaption } from "@/lib/draw/caption";
import { assembleMatchAnalysisFacts } from "@/lib/match-analysis/assemble";
import { chooseHalves } from "@/lib/match-analysis/halves";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { topPlayers } from "@/lib/player-stats/picks";
import { buildMatchScorecard, buildPeriodScorecard } from "@/lib/prediction/scorecard";
import { periodFor } from "@/lib/prediction/scorecard-period";
import { apiFootballHalfRows } from "@/lib/services/api-football/half-stats-mappers";
import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import type { LineupDraft } from "@/types/lineup";
import type { H2HCard } from "@/types/player-h2h";
import type { MatchDayCard } from "@/types/match-day";
import type { MatchResultFacts } from "@/types/match-result";
import type { StandingsGroup } from "@/types/standings";
import type { MatchStats } from "@/types/sports";
import type { VitrinCard } from "@/types/vitrin";
import type { WeeklyMatch } from "@/types/weekly-fixtures";
import { RAW_GENCLERBIRLIGI_GALATASARAY } from "./api-football/match-result";
import { HALF_KONYASPOR_GALATASARAY, RAW_KONYASPOR_GALATASARAY } from "./api-football/match-analysis-real";
import { RAW_MILAN_BOLOGNA, SM_MILAN_BOLOGNA_IDS, SM_MILAN_BOLOGNA_LINEUP } from "./api-football/player-match-stats";
import { DRAW_KNOCKOUT, DRAW_LEAGUE } from "./draw";
import { H2H_LEFT, H2H_RIGHT } from "./player-h2h";
import { KONYA_GS, KONYA_GS_ALL_SIX, octoberEntries } from "./prediction-scorecard";

/**
 * Gönderi metni bekçisinin EN KÖTÜ durum metinleri (kurgusal, 2026-10-31): her aktif içerik türü için gerçek
 * kurucu + uzun takım adları, çok golcü, Kura B'de üç turnuva × beş takım, 20 takımlı ve 8 gruplu puan tablosu,
 * 12 maçlı hafta, 11 uzun adlı diziliş, 160 karakterlik Vitrin gerekçeleri.
 */

const HOME = "Borussia Mönchengladbach";
const AWAY = "Union Saint-Gilloise";
const LONG_COMPETITION = { kind: "CUP", name: "UEFA Konferans Ligi", leagueId: 848, logoUrl: "" };

const scorer = (name: string, minutes: string[]) => ({ playerId: null, name, minutes });
const RESULT_FACTS = {
  competition: LONG_COMPETITION,
  roundLabel: "Lig Aşaması · 6. Maç",
  penaltyScore: "10-9",
  home: { name: HOME, goals: 5, scorers: [scorer("A. Abdelkader-Bensebaini", ["12'", "45+3'"]), scorer("F. Honorat-Dominguez", ["67'"]), scorer("T. Kleindienst", ["88'", "90+6' (P)"])] },
  away: { name: AWAY, goals: 5, scorers: [scorer("K. Vanzeir-Puertas", ["3'", "58'"]), scorer("C. Puertas-Lopez", ["71' (KK)"]), scorer("M. Rasmussen-Ait El Hadj", ["90+2'", "105'"])] },
} as unknown as MatchResultFacts;

const statsFacts = () => {
  const facts = toMatchStatsFacts(RAW_GENCLERBIRLIGI_GALATASARAY, null);
  if (!facts) throw new Error("fixture");
  return { ...facts, competition: { ...facts.competition, name: LONG_COMPETITION.name }, roundLabel: "Lig Aşaması · 6. Maç", home: { ...facts.home, name: HOME }, away: { ...facts.away, name: AWAY } };
};

const playerFacts = () => {
  const facts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, new Date("2026-10-30T12:00:00Z"), { players: SM_MILAN_BOLOGNA_LINEUP, ids: SM_MILAN_BOLOGNA_IDS });
  if (!facts) throw new Error("fixture");
  return { ...facts, match: { ...facts.match, ...RESULT_FACTS, home: { ...facts.match.home, name: HOME }, away: { ...facts.match.away, name: AWAY } } };
};

const analysisFacts = () => {
  const facts = assembleMatchAnalysisFacts(RAW_KONYASPOR_GALATASARAY, chooseHalves(apiFootballHalfRows(HALF_KONYASPOR_GALATASARAY, { home: 607, away: 645 }), null, false));
  if (!facts) throw new Error("fixture");
  return { ...facts, match: { ...facts.match, roundLabel: "Lig Aşaması · 6. Maç", competition: { ...facts.match.competition, name: LONG_COMPETITION.name }, home: { ...facts.match.home, name: HOME }, away: { ...facts.match.away, name: AWAY } } };
};

const REASON = "Borussia Mönchengladbach son 5 maçta maç başı 2,4 gol attı ve bu sezon ligde iç sahada oynadığı maçların dördünde ilk yarıyı önde kapattı, rakibi 1,1 gol yedi.";
const VITRIN = {
  names: { home: HOME, away: AWAY, competition: "UEFA Konferans Ligi", round: "Lig Aşaması · 6. Maç" },
  open: [
    { title: "Kazanma olasılıkları", lines: [{ label: HOME, value: "%40" }, { label: "Beraberlik", value: "%22" }, { label: AWAY, value: "%38" }], reason: REASON },
    { title: "İki takım da gol bulur mu?", lines: [{ label: "Evet", value: "%69" }], reason: `${REASON} Fark.` },
  ],
  hook: ["Modelimiz bu maç için 38 senaryo hesapladı.", "En sürpriz olanı sadece %4 ihtimalle gerçekleşiyor — tamamı checkmatch.net'te."],
} as unknown as VitrinCard;

const H2H_CARD = {
  hero: ["Gol", "Asist", "Şut", "İsabetli şut", "Kilit pas"].map((label, index) => ({ label, leftText: `${index + 10},5`, rightText: `${index + 8},25` })),
  fact: "Aktürkoğlu daha az dakikada daha çok gol attı ve daha çok şut çekti",
  modeLabel: "90 DAKİKA BAŞINA",
  scopeLabel: "2026/27 · SÜPER LİG · 26.10 İTİBARIYLA",
} as unknown as Pick<H2HCard, "hero" | "fact" | "modeLabel" | "scopeLabel">;

const row = (rank: number, teamName: string) => ({ rank, teamName, points: 99 - rank, played: 38, goalDiff: 40 - rank * 4 });
const LONG_TEAMS = ["Borussia Mönchengladbach", "Wolverhampton Wanderers", "Brighton & Hove Albion", "Nottingham Forest", "Union Saint-Gilloise", "Paris Saint-Germain", "Eintracht Frankfurt", "Bayer Leverkusen", "Çaykur Rizespor", "Gaziantep FK", "Fatih Karagümrük", "Gençlerbirliği", "Kasımpaşa", "Kocaelispor", "Başakşehir", "Trabzonspor", "Galatasaray", "Fenerbahçe", "Beşiktaş", "Göztepe SK"];
const TABLE = [{ key: "Süper Lig", label: "", rows: LONG_TEAMS.map((name, index) => row(index + 1, name)) }] as unknown as StandingsGroup[];
const GROUPS = "ABCDEFGH".split("").map((letter, group) => ({ key: `Group ${letter}`, label: `${letter} GRUBU`, rows: LONG_TEAMS.slice(group * 2, group * 2 + 4).map((name, index) => row(index + 1, name)) })) as unknown as StandingsGroup[];

const weekly = (index: number): WeeklyMatch => ({
  id: `api-football-${index}`,
  kickoffUtc: "2026-10-30T17:00:00Z",
  dateKey: `2026-10-${28 + (index % 4)}`,
  time: "20.00",
  status: index < 3 ? "finished" : "scheduled",
  elapsed: null,
  home: { name: LONG_TEAMS[index] ?? HOME, logoUrl: "", goals: index < 3 ? 3 : null },
  away: { name: LONG_TEAMS[19 - index] ?? AWAY, logoUrl: "", goals: index < 3 ? 2 : null },
}) as WeeklyMatch;

const slots = (prefix: string) => Array.from({ length: 11 }, (_, index) => ({ name: `${prefix}. Abdelkader-Bensebaini${index}` }));
const LINEUP = {
  headline: "MUHTEMEL 11",
  matchLabel: "UEFA Konferans Ligi · 30.10 · 20:00",
  home: { teamName: HOME, formation: "4-2-3-1", slots: slots("A") },
  away: { teamName: AWAY, formation: "3-4-1-2", slots: slots("K") },
} as unknown as LineupDraft;

const MATCH_DAY = {
  homeTeam: HOME.toLocaleUpperCase("tr-TR"),
  awayTeam: AWAY.toLocaleUpperCase("tr-TR"),
  homeTeamName: HOME,
  awayTeamName: AWAY,
  leagueLabel: "UEFA KONFERANS LİGİ",
  weekLabel: "LİG AŞAMASI · 6. MAÇ",
  dateLabel: "31 EKİM 2026 CUMARTESİ",
  timeLabel: "20:00",
  stadiumLabel: "Stadion im Borussia-Park, Mönchengladbach",
  refereeLabel: "Reşat Onur Coşkunses",
} as unknown as MatchDayCard;

const DRAFT_STATS = {
  fixture: { kickoffUtc: "2026-10-31T17:00:00Z", homeTeam: { name: "Galatasaray" }, awayTeam: { name: "Fenerbahce" }, competition: { name: "Trendyol Süper Lig", shortName: "Süper Lig" } },
  home: { teamName: "Galatasaray", last5: ["W", "D", "L", "W", "W"], goalsForAvg: 1.8, xgForAvg: 1.62 },
  away: { teamName: "Fenerbahçe", last5: ["W", "W", "W", "D", "L"], goalsForAvg: 2.2, xgForAvg: 1.9 },
  headToHead: { matches: [{}], homeWins: 1, draws: 0, awayWins: 0 },
} as unknown as MatchStats;

const october = periodFor("MONTH", new Date("2026-10-15T12:00:00Z"));
const ok = <T,>(result: { ok: true; data: T } | { ok: false }): T => {
  if (!result.ok) throw new Error("fixture");
  return result.data;
};
const tie = (state: typeof DRAW_LEAGUE, competition: { id: number; name: string }) => ({ ...state, competition });

export interface CaptionCase {
  type: string;
  caption: string;
}

/** Bütün aktif içerik türlerinin şablon metinleri — en kötü durum verisiyle. */
export function worstCaseCaptions(): CaptionCase[] {
  const players = playerFacts();
  const [best] = topPlayers(players.lines, 1);
  if (!best) throw new Error("fixture");
  const match = ok(buildMatchScorecard({ fixtureId: KONYA_GS.fixtureId, sides: { home: KONYA_GS.home.name, away: KONYA_GS.away.name }, score: KONYA_GS.score, records: KONYA_GS_ALL_SIX }));
  return [
    { type: "MATCH_DAY", caption: buildMatchDayCaption(MATCH_DAY) },
    { type: "WEEKLY_FIXTURES", caption: weeklyCaption("UEFA Konferans Ligi", "Lig Aşaması · 6. Maç", Array.from({ length: 12 }, (_, index) => weekly(index)), "date") },
    { type: "PROBABLE_LINEUPS", caption: buildLineupCaption(LINEUP) },
    { type: "AI_MARKET_PREDICTION", caption: buildVitrinCaption(VITRIN) },
    { type: "PLAYER_H2H", caption: buildH2HCaption({ ...H2H_LEFT, fullName: "Kerem Aktürkoğlu-Abdelkader" }, { ...H2H_RIGHT, fullName: "Alassane Pléa-Honorat Dominguez" }, H2H_CARD) },
    { type: "DRAWS_AND_PAIRINGS A", caption: buildDrawCaption("TEAM", [DRAW_LEAGUE], 611) },
    { type: "DRAWS_AND_PAIRINGS B", caption: buildDrawCaption("TURKISH", [DRAW_LEAGUE, tie(DRAW_LEAGUE, { id: 3, name: "UEFA Avrupa Ligi" }), tie(DRAW_LEAGUE, { id: 848, name: "UEFA Konferans Ligi" })], null) },
    { type: "DRAWS_AND_PAIRINGS C", caption: buildDrawCaption("ALL", [DRAW_KNOCKOUT], null) },
    { type: "MATCH_RESULT", caption: buildMatchResultCaption(RESULT_FACTS, "A. Abdelkader-Bensebaini") },
    { type: "MATCH_STATS", caption: buildMatchStatsCaption(statsFacts()) },
    { type: "PLAYER_STATS A", caption: buildSpotlightCaption(players, best, undefined, "Maçın en çok başarılı dripling yapan ve en çok top kazanan oyuncusu (7)") },
    { type: "PLAYER_STATS B5", caption: buildTopPlayersCaption(players, topPlayers(players.lines, 5)) },
    { type: "MATCH_ANALYSIS", caption: buildMatchAnalysisCaption(analysisFacts()) },
    { type: "PREDICTION_SCORECARD A", caption: buildMatchScorecardCaption({ ...KONYA_GS, home: { ...KONYA_GS.home, name: HOME }, away: { ...KONYA_GS.away, name: AWAY } }, match) },
    { type: "PREDICTION_SCORECARD B", caption: buildPeriodScorecardCaption(ok(buildPeriodScorecard({ period: october, entries: octoberEntries(24), splitByModelVersion: true }))) },
    { type: "STANDINGS", caption: standingsCaption("Trendyol Süper Lig", "2026/27", "Puan Durumu", TABLE) },
    { type: "STANDINGS groups", caption: standingsCaption("UEFA Şampiyonlar Ligi", "2026/27", "Puan Durumu", GROUPS) },
    { type: "STUDIO", caption: buildDraftCaption(DRAFT_STATS) },
  ];
}
