import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";

/**
 * Maçtan başlarken her takımın önerilen oyuncusu — saf: ligde gol + asist lideri; eşitlikte daha çok
 * gol, sonra daha çok dakika. Kaleci önerilmez. Veri yoksa null (öneri yok, admin seçer).
 */

export interface LeaderPick {
  playerId: number;
  name: string;
  goals: number;
  assists: number;
  minutes: number;
}

export function goalContributionLeader(players: ApiFootballPlayerSeason[], teamId: number, leagueId: number): LeaderPick | null {
  const candidates = players.flatMap((entry) => {
    const stat = entry.statistics.find((s) => s.team.id === teamId && s.league.id === leagueId);
    if (!stat || stat.games.position === "Goalkeeper" || (stat.games.minutes ?? 0) <= 0) return [];
    return [{ playerId: entry.player.id, name: entry.player.name, goals: stat.goals?.total ?? 0, assists: stat.goals?.assists ?? 0, minutes: stat.games.minutes ?? 0 }];
  });
  const sorted = candidates.sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || b.minutes - a.minutes);
  const best = sorted[0];
  return best && best.goals + best.assists > 0 ? best : null;
}
