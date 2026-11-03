import { reelAbsences, type ReelAbsenceStatus, type ReelContext, reelStandings, reelTeamContext, sidelinedOn, topContributors } from "@/lib/reels/context-rule";
import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import { getHeadToHead } from "@/lib/services/api-football/match-stats";
import { getFixtureInjuries, getPlayerSidelined, getStandingRows, getTeamInjuriesOn, getTeamStatistics, type InjuryRaw, type ReelStandingRowRaw, type SidelinedRaw, type TeamStatisticsRaw } from "@/lib/services/api-football/reel-context";
import { getSeasonLeagueXg } from "@/lib/services/api-football/season-xg";
import { getTeamLeaguePlayers } from "@/lib/services/api-football/team-player-stats";
import { getLeagueSeasons } from "@/lib/services/api-football/weekly-fixtures";
import type { HeadToHeadSummary } from "@/types/sports";
import { istanbulDay } from "@/lib/metrics/istanbul-time";

/**
 * Futbol okumasını API-Football'dan toplar. Yalnız admin tıklamasıyla (dondurma) çağrılır, zamanlayıcıdan çağrılmaz (CLAUDE.md 1.10).
 * Bir uç hata verirse o bölüm boş kalır ve uyarı döner: dondurma durmaz, ilgili sahne kapanır.
 */

/** Takım başına sidelined sorgusu: sakat listesine girmemiş uzun süreli eksikler için, en çok katkı veren oyuncular. */
export const SIDELINED_CHECKS_PER_TEAM = 3;

type Outcome<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

export interface ReelContextDeps {
  season: (leagueId: number) => Promise<Outcome<{ current: number }>>;
  standings: (leagueId: number, season: number) => Promise<Outcome<ReelStandingRowRaw[]>>;
  statistics: (teamId: number, leagueId: number, season: number) => Promise<Outcome<TeamStatisticsRaw>>;
  fixtureInjuries: (fixtureId: number) => Promise<Outcome<InjuryRaw[]>>;
  teamInjuries: (teamId: number, season: number, day: string) => Promise<Outcome<InjuryRaw[]>>;
  sidelined: (playerId: number) => Promise<Outcome<SidelinedRaw[]>>;
  players: (teamId: number, season: number, leagueId: number) => Promise<Outcome<ApiFootballPlayerSeason[]>>;
  h2h: (homeId: number, awayId: number, beforeUtc: string) => Promise<Outcome<HeadToHeadSummary>>;
  xg: (teamId: number, beforeUtc: string) => Promise<Outcome<{ xgForAvg: number | null; matchesSampled: number } | null>>;
}

const DEPS: ReelContextDeps = { season: getLeagueSeasons, standings: getStandingRows, statistics: getTeamStatistics, fixtureInjuries: getFixtureInjuries, teamInjuries: getTeamInjuriesOn, sidelined: getPlayerSidelined, players: getTeamLeaguePlayers, h2h: getHeadToHead, xg: getSeasonLeagueXg };

export interface ReelContextProject { matchId: number; leagueId: number; homeTeamId: number; homeName: string; awayTeamId: number; awayName: string; kickoffUtc: Date }
export interface ReelContextResult { context: ReelContext | null; warnings: string[]; requests: Record<string, number> }

const MIN_XG_MATCHES = 5;

export async function loadReelContext(project: ReelContextProject, deps: ReelContextDeps = DEPS, now: Date = new Date()): Promise<ReelContextResult> {
  const warnings: string[] = [];
  const requests: Record<string, number> = {};
  const count = (name: string, by = 1) => { requests[name] = (requests[name] ?? 0) + by; };
  const take = <T>(label: string, result: Outcome<T>): T | null => {
    if (result.ok) return result.data;
    warnings.push(`${label}: ${result.error.message}`);
    return null;
  };

  count("leagues");
  const season = take("Sezon", await deps.season(project.leagueId))?.current ?? null;
  if (season === null) return { context: null, warnings, requests };
  const { homeTeamId: homeId, awayTeamId: awayId, leagueId } = project;
  const beforeUtc = project.kickoffUtc.toISOString();
  const day = istanbulDay(project.kickoffUtc);

  count("standings");
  count("teams/statistics", 2);
  count("fixtures/headtohead");
  count("players (sayfa başına)", 2);
  const [standings, homeStats, awayStats, h2h, homePlayers, awayPlayers, homeXg, awayXg] = await Promise.all([
    deps.standings(leagueId, season), deps.statistics(homeId, leagueId, season), deps.statistics(awayId, leagueId, season), deps.h2h(homeId, awayId, beforeUtc),
    deps.players(homeId, season, leagueId), deps.players(awayId, season, leagueId), deps.xg(homeId, beforeUtc), deps.xg(awayId, beforeUtc),
  ]);
  const rows = take("Puan durumu", standings);
  const stats = { home: take(`${project.homeName} istatistiği`, homeStats), away: take(`${project.awayName} istatistiği`, awayStats) };
  if (!stats.home && !stats.away) return { context: null, warnings, requests };
  const players = { home: take(`${project.homeName} oyuncuları`, homePlayers), away: take(`${project.awayName} oyuncuları`, awayPlayers) };
  const xgOf = (result: typeof homeXg, name: string) => {
    const value = take(`${name} xG`, result);
    return value && value.matchesSampled >= MIN_XG_MATCHES ? value.xgForAvg : null;
  };

  // Eksikler: önce maç listesi; boşsa takım + gün. Sakatlık uçlarından biri okunamazsa bölüm null: "eksik yok" denemez.
  count("injuries");
  const fixtureList = await deps.fixtureInjuries(project.matchId);
  let injuries = take("Eksikler", fixtureList);
  if (injuries !== null && injuries.length === 0) {
    count("injuries", 2);
    const [homeList, awayList] = await Promise.all([deps.teamInjuries(homeId, season, day), deps.teamInjuries(awayId, season, day)]);
    const [home, away] = [take("Eksikler", homeList), take("Eksikler", awayList)];
    injuries = home && away ? [...home, ...away] : null;
  }
  const longTerm = async (list: readonly ApiFootballPlayerSeason[] | null, teamId: number) => {
    const found: { player: ApiFootballPlayerSeason; status: ReelAbsenceStatus }[] = [];
    for (const player of topContributors(list ?? [], teamId, leagueId, SIDELINED_CHECKS_PER_TEAM)) {
      count("sidelined");
      const entries = take("Sakatlık geçmişi", await deps.sidelined(player.player.id));
      const status = entries ? sidelinedOn(entries, day) : null;
      if (status) found.push({ player, status });
    }
    return found;
  };
  const absenceSide = async (list: readonly ApiFootballPlayerSeason[] | null, teamId: number) =>
    reelAbsences({ injuries: injuries ?? [], sidelined: await longTerm(list, teamId), players: list ?? [], teamId, leagueId });
  const absences = injuries === null ? null : { home: await absenceSide(players.home, homeId), away: await absenceSide(players.away, awayId) };

  const table = reelStandings(rows, homeId, awayId);
  const meetings = take("Karşılaşmalar", h2h);
  const playedH2h = meetings?.matches.length ?? 0;
  const context: ReelContext = {
    fetched_at: now.toISOString(),
    source: "api-football",
    season,
    standings: table.lines,
    teams: {
      home: reelTeamContext(stats.home, table.home, "home", xgOf(homeXg, project.homeName)),
      away: reelTeamContext(stats.away, table.away, "away", xgOf(awayXg, project.awayName)),
    },
    absences,
    h2h: meetings && playedH2h > 0 ? { played: playedH2h, home_wins: meetings.homeWins, draws: meetings.draws, away_wins: meetings.awayWins, avg_goals: Math.round((meetings.matches.reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0) / playedH2h) * 10) / 10 } : null,
    polished: null,
  };
  return { context, warnings, requests };
}
