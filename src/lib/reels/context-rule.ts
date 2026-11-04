import { cardPersonName } from "@/lib/names/person-name";
import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import { formationLines, type ReelLastLineup, type ReelLineupPlayer } from "@/lib/reels/lineup-rule";
import type { InjuryRaw, LastLineupRaw, ReelStandingRowRaw, SidelinedRaw, TeamStatisticsRaw } from "@/lib/services/api-football/reel-context";

/**
 * Ham API-Football yanıtı → dondurulan futbol okuması (saf). Şekil `reels-video/src/story/match-context.ts` ile birebir;
 * birebirliği `tests/unit/reels-context.test.ts` tip düzeyinde sabitler. Eksik veri `null`, sıfır yazılmaz.
 */

export const REEL_GOAL_SLOT_COUNT = 6;
const MINUTE_KEYS = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"] as const;
/** Dilim toplamı ile sezon golü arasında kabul edilen fark. */
export const MINUTE_TOLERANCE_PCT = 30;
const STOPPAGE_KEY = "91-105";
const EXTRA_KEY = "106-120";

export interface ReelVenueRecord { played: number; win: number; draw: number; lose: number; goals_for: number; goals_against: number }
export interface ReelStandingLine { rank: number; points: number; played: number; goals_diff: number }
export interface ReelTeamContext {
  form: string | null;
  played: number;
  wins: number;
  loses: number;
  venue: ReelVenueRecord | null;
  goals_for_avg: number | null;
  goals_against_avg: number | null;
  xg_for_avg: number | null;
  clean_sheet_pct: number | null;
  failed_to_score_pct: number | null;
  formation: { name: string; played: number } | null;
  lineup: ReelLastLineup | null;
  streaks: { wins: number; draws: number; loses: number };
  minutes: { for: (number | null)[]; against: (number | null)[] };
}
export type ReelAbsenceStatus = "injured" | "suspended" | "doubtful";
export interface ReelAbsence { player_id: number; name: string; status: ReelAbsenceStatus; minutes: number | null; goals: number | null; assists: number | null; involvement_pct: number | null }
export interface ReelContext {
  fetched_at: string;
  source: "api-football";
  season: number;
  standings: { home: ReelStandingLine | null; away: ReelStandingLine | null; league_goals_avg: number | null };
  teams: { home: ReelTeamContext; away: ReelTeamContext };
  absences: { home: ReelAbsence[]; away: ReelAbsence[] } | null;
  h2h: { played: number; home_wins: number; draws: number; away_wins: number; avg_goals: number | null } | null;
  polished: Record<string, string> | null;
}

const toNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};
const share = (part: number | null | undefined, total: number): number | null => (part === null || part === undefined || total <= 0 ? null : Math.round((part / total) * 1000) / 10);

/**
 * Dakika dilimleri: sağlayıcı golsüz dilimde `total: null` verir, null = 0. Canlı yanıtta dilim toplamı sezon golüne eşit
 * değil (11-03, Gaziantep: 7 ↔ 9 ve 19 ↔ 17). Fark sezon golünün %30'unu aşarsa ya da hiç dilim yoksa veri eksik sayılır,
 * hepsi null kalır, sahne kapanır. 91–105 son dilime eklenir; 106–120 uzatmadır, sayılmaz.
 */
export function reelGoalMinutes(side: NonNullable<NonNullable<TeamStatisticsRaw["goals"]>["for"]> | undefined): (number | null)[] {
  const empty = MINUTE_KEYS.map(() => null);
  const minute = side?.minute;
  const total = side?.total?.total;
  if (!minute || total === null || total === undefined) return empty;
  const at = (key: string) => minute[key]?.total ?? 0;
  const counted = [...MINUTE_KEYS, STOPPAGE_KEY, EXTRA_KEY].reduce((sum, key) => sum + at(key), 0);
  if (total > 0 && counted === 0) return empty;
  if ((Math.abs(counted - total) / Math.max(total, 1)) * 100 > MINUTE_TOLERANCE_PCT) return empty;
  return MINUTE_KEYS.map((key, index) => at(key) + (index === MINUTE_KEYS.length - 1 ? at(STOPPAGE_KEY) : 0));
}

function venueOf(row: ReelStandingRowRaw | undefined, side: "home" | "away"): ReelVenueRecord | null {
  const record = row?.[side];
  if (!record || record.played === null || record.played === undefined) return null;
  return { played: record.played, win: record.win ?? 0, draw: record.draw ?? 0, lose: record.lose ?? 0, goals_for: record.goals?.for ?? 0, goals_against: record.goals?.against ?? 0 };
}

const standingLine = (row: ReelStandingRowRaw | undefined): ReelStandingLine | null =>
  row && row.points !== null && row.points !== undefined ? { rank: row.rank, points: row.points, played: row.all?.played ?? 0, goals_diff: row.goalsDiff ?? 0 } : null;

/** Ligin maç başı takım golü: tablonun toplamından. */
export function leagueGoalsAvg(rows: readonly ReelStandingRowRaw[]): number | null {
  const goals = rows.reduce((sum, row) => sum + (row.all?.goals?.for ?? 0), 0);
  const played = rows.reduce((sum, row) => sum + (row.all?.played ?? 0), 0);
  return played > 0 ? Math.round((goals / played) * 100) / 100 : null;
}

/**
 * En uzun seri form dizisinden sayılır. Sağlayıcının `biggest.streak` alanı kullanılmaz: canlı yanıtta form "…LLLLL" iken
 * `loses: 1` geldi (11-03, Gaziantep).
 */
export function longestRun(form: string | null, letter: "W" | "D" | "L"): number {
  return (form ?? "").split("").reduce((run, item) => (item === letter ? { now: run.now + 1, best: Math.max(run.best, run.now + 1) } : { now: 0, best: run.best }), { now: 0, best: 0 }).best;
}

const gridPart = (grid: string | null | undefined, part: 0 | 1): number => Number.parseInt((grid ?? "").split(":")[part] ?? "", 10) || 99;

/**
 * Lineups → kaleciden forvete sıralı 11. `grid` "hat:sütun"; canlıda (11-04, Galatasaray) 1. sütun sol bek, 4. sütun sağ bek çıktı, tek
 * örnek: ekranda sıra için kullanılır, seslendirmede sağ/sol iddiası kurulmaz. 11 oyuncu ya da geçerli diziliş yoksa null.
 */
export function reelLastLineup(raw: LastLineupRaw | null): ReelLastLineup | null {
  if (!raw?.formation || !formationLines(raw.formation) || raw.startXI.length !== 11) return null;
  const ordered = [...raw.startXI].sort((a, b) => gridPart(a.grid, 0) - gridPart(b.grid, 0) || gridPart(a.grid, 1) - gridPart(b.grid, 1));
  return { fixture_id: raw.fixtureId, date: raw.date, formation: raw.formation, players: ordered.map((player) => reelLineupPlayer(player.id, player.name, player.number ?? null)) };
}

export function reelLineupPlayer(id: number, apiName: string, number: number | null): ReelLineupPlayer {
  const card = cardPersonName({ apiName });
  return { id, name: card.name, short_name: card.short, number };
}

export function reelTeamContext(stats: TeamStatisticsRaw | null, row: ReelStandingRowRaw | undefined, side: "home" | "away", xgForAvg: number | null, lastLineup: ReelLastLineup | null = null): ReelTeamContext {
  const played = stats?.fixtures?.played?.total ?? 0;
  const lineup = (stats?.lineups ?? []).flatMap((item) => (item.formation && item.played ? [{ name: item.formation, played: item.played }] : [])).sort((a, b) => b.played - a.played)[0] ?? null;
  const form = stats?.form ?? null;
  return {
    form,
    played,
    wins: stats?.fixtures?.wins?.total ?? 0,
    loses: stats?.fixtures?.loses?.total ?? 0,
    venue: venueOf(row, side),
    goals_for_avg: toNumber(stats?.goals?.for?.average?.total),
    goals_against_avg: toNumber(stats?.goals?.against?.average?.total),
    xg_for_avg: xgForAvg,
    clean_sheet_pct: share(stats?.clean_sheet?.total, played),
    failed_to_score_pct: share(stats?.failed_to_score?.total, played),
    formation: lineup,
    lineup: lastLineup,
    streaks: { wins: longestRun(form, "W"), draws: longestRun(form, "D"), loses: longestRun(form, "L") },
    minutes: { for: reelGoalMinutes(stats?.goals?.for), against: reelGoalMinutes(stats?.goals?.against) },
  };
}

/**
 * Belge: `Missing Fixture` oynamayacak, `Questionable` şüpheli. Ceza `reason` içinde gelir ("Red Card" canlıda görüldü). "Off the roster"
 * sakatlık değil kadro dışıdır (canlıda en sık sebeplerden): eksik listesine girmez. Sebep metni ekrana yazılmaz.
 */
export function reelAbsenceStatus(type: string | null | undefined, reason: string | null | undefined): ReelAbsenceStatus | null {
  if (type === "Questionable") return "doubtful";
  if (type !== "Missing Fixture" || /off the roster/iu.test(reason ?? "")) return null;
  return /suspend|red card|yellow card/iu.test(reason ?? "") ? "suspended" : "injured";
}

/** Maç anında sürüyor mu: başlangıç ≤ maç günü ≤ bitiş. Bitişsiz kayıt sürüyor sayılmaz: süresi bilinmeyen eski kayıtlar çok. */
export function sidelinedOn(entries: readonly SidelinedRaw[], day: string): ReelAbsenceStatus | null {
  const active = entries.find((entry) => entry.start && entry.end && entry.start <= day && day <= entry.end);
  if (!active) return null;
  return /suspend/iu.test(active.type ?? "") ? "suspended" : "injured";
}

interface PlayerLine { minutes: number | null; goals: number | null; assists: number | null }

/** Oyuncunun bu lig + takımdaki sezon toplamı. */
export function playerLine(player: ApiFootballPlayerSeason, teamId: number, leagueId: number): PlayerLine | null {
  const entry = player.statistics.find((item) => item.team.id === teamId && item.league.id === leagueId);
  return entry ? { minutes: entry.games.minutes ?? null, goals: entry.goals?.total ?? null, assists: entry.goals?.assists ?? null } : null;
}

export function reelAbsences(input: { injuries: readonly InjuryRaw[]; sidelined: readonly { player: ApiFootballPlayerSeason; status: ReelAbsenceStatus }[]; players: readonly ApiFootballPlayerSeason[]; teamId: number; leagueId: number }): ReelAbsence[] {
  const lines = new Map(input.players.flatMap((player) => {
    const line = playerLine(player, input.teamId, input.leagueId);
    return line ? [[player.player.id, line] as const] : [];
  }));
  const teamTotal = [...lines.values()].reduce((sum, line) => sum + (line.goals ?? 0) + (line.assists ?? 0), 0);
  const seen = new Map<number, ReelAbsence>();
  const add = (id: number, apiName: string, status: ReelAbsenceStatus) => {
    if (seen.has(id)) return;
    const line = lines.get(id);
    const involvement = line && line.goals !== null ? line.goals + (line.assists ?? 0) : null;
    seen.set(id, { player_id: id, name: cardPersonName({ apiName }).name, status, minutes: line?.minutes ?? null, goals: line?.goals ?? null, assists: line?.assists ?? null, involvement_pct: share(involvement, teamTotal) === null ? null : Math.round(share(involvement, teamTotal) ?? 0) });
  };
  for (const injury of input.injuries) {
    if (injury.team.id !== input.teamId) continue;
    const status = reelAbsenceStatus(injury.player.type, injury.player.reason);
    if (status) add(injury.player.id, injury.player.name, status);
  }
  for (const item of input.sidelined) add(item.player.player.id, item.player.player.name, item.status);
  return [...seen.values()].sort((a, b) => (b.involvement_pct ?? -1) - (a.involvement_pct ?? -1));
}

/** En çok gol + asist yapan oyuncular: sidelined sorgusu bunlar için. */
export function topContributors(players: readonly ApiFootballPlayerSeason[], teamId: number, leagueId: number, limit: number): ApiFootballPlayerSeason[] {
  const score = (player: ApiFootballPlayerSeason) => {
    const line = playerLine(player, teamId, leagueId);
    return (line?.goals ?? 0) + (line?.assists ?? 0);
  };
  return [...players].filter((player) => score(player) > 0).sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export function reelStandings(rows: readonly ReelStandingRowRaw[] | null, homeId: number, awayId: number): { lines: ReelContext["standings"]; home: ReelStandingRowRaw | undefined; away: ReelStandingRowRaw | undefined } {
  const home = rows?.find((row) => row.team.id === homeId);
  const away = rows?.find((row) => row.team.id === awayId);
  return { home, away, lines: { home: standingLine(home), away: standingLine(away), league_goals_avg: rows ? leagueGoalsAvg(rows) : null } };
}
