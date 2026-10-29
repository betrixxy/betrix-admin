import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import type { H2HPosition } from "@/types/player-h2h";
import { positionFromApi } from "./stats";

/**
 * Maçtan başlarken her takımın önerilen oyuncusu — saf. Varsayılan: iki takımın FORVETLERİ (ligde gol +
 * asist lideri forvet; forvet verisi yoksa kaleci dışı gol + asist lideri). Admin bir tarafı değiştirince
 * diğer taraf aynı mevkiden önerilir (`positionLeaders`). Sıralama: gol + asist, eşitlikte gol, sonra
 * dakika; kalecide yalnızca dakika. Veri yoksa null (öneri yok, admin seçer).
 */

export interface LeaderPick {
  playerId: number;
  name: string;
  position: H2HPosition | null;
  goals: number;
  assists: number;
  minutes: number;
}

function candidates(players: ApiFootballPlayerSeason[], teamId: number, leagueId: number): LeaderPick[] {
  return players.flatMap((entry) => {
    const stat = entry.statistics.find((s) => s.team.id === teamId && s.league.id === leagueId);
    if (!stat || (stat.games.minutes ?? 0) <= 0) return [];
    return [{ playerId: entry.player.id, name: entry.player.name, position: positionFromApi(stat.games.position), goals: stat.goals?.total ?? 0, assists: stat.goals?.assists ?? 0, minutes: stat.games.minutes ?? 0 }];
  });
}

const byContribution = (a: LeaderPick, b: LeaderPick) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || b.minutes - a.minutes;
const byMinutes = (a: LeaderPick, b: LeaderPick) => b.minutes - a.minutes;

/** Kaleci dışı gol + asist lideri (gol/asist yoksa null). */
export function goalContributionLeader(players: ApiFootballPlayerSeason[], teamId: number, leagueId: number): LeaderPick | null {
  const best = candidates(players, teamId, leagueId).filter((pick) => pick.position !== "GK").sort(byContribution)[0];
  return best && best.goals + best.assists > 0 ? best : null;
}

/** Mevki başına lider: forvet/orta saha/defans gol + asist (eşitlikte dakika), kaleci dakika. */
export function positionLeaders(players: ApiFootballPlayerSeason[], teamId: number, leagueId: number): Partial<Record<H2HPosition, LeaderPick>> {
  const pool = candidates(players, teamId, leagueId);
  const out: Partial<Record<H2HPosition, LeaderPick>> = {};
  for (const position of ["FWD", "MID", "DEF", "GK"] as const) {
    const best = pool.filter((pick) => pick.position === position).sort(position === "GK" ? byMinutes : byContribution)[0];
    if (best) out[position] = best;
  }
  return out;
}

/** Varsayılan öneri: forvet lideri (gol + asist > 0); yoksa kaleci dışı gol + asist lideri. */
export function defaultLeader(players: ApiFootballPlayerSeason[], teamId: number, leagueId: number): LeaderPick | null {
  const forward = positionLeaders(players, teamId, leagueId).FWD;
  return forward && forward.goals + forward.assists > 0 ? forward : goalContributionLeader(players, teamId, leagueId);
}
