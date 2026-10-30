import { keeperConceded } from "@/lib/player-stats/keeper";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { MatchSide } from "@/types/match-result";
import type { PlayerMatchLine, PlayerPosition } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri: `/fixtures?id=` yanıtının `players` bloğu → kanonik maç satırları (saf). Sağlayıcının
 * boş bıraktığı alan null kalır — 0'a çevrilmez (kaleci `goals.conceded` sık sık boş gelir). Maçta süre almayan
 * (dakikası boş ya da 0) oyuncu listeye girmez. Kalecinin yenilediği gol maç olaylarından hesaplanır (`keeper.ts`).
 */

type RawStats = ApiFootballFixtureResultRaw["players"][number]["players"][number]["statistics"][number];

/** Sayı ya da sayısal metin ("23", "85%") → sayı; boş/bozuk → null (asla 0). */
function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRating(value: string | null | undefined): number | null {
  const rating = Number(value);
  return value && Number.isFinite(rating) && rating > 0 ? rating : null;
}

function position(value: string | null | undefined): PlayerPosition | null {
  return value === "G" || value === "D" || value === "M" || value === "F" ? value : null;
}

export function playerMatchNumbers(stats: RawStats | undefined): PlayerMatchLine["numbers"] {
  return {
    goals: num(stats?.goals?.total),
    assists: num(stats?.goals?.assists),
    shotsTotal: num(stats?.shots?.total),
    shotsOn: num(stats?.shots?.on),
    keyPasses: num(stats?.passes?.key),
    passesTotal: num(stats?.passes?.total),
    passesAccurate: num(stats?.passes?.accuracy),
    dribblesAttempts: num(stats?.dribbles?.attempts),
    dribblesSuccess: num(stats?.dribbles?.success),
    duelsTotal: num(stats?.duels?.total),
    duelsWon: num(stats?.duels?.won),
    tackles: num(stats?.tackles?.total),
    interceptions: num(stats?.tackles?.interceptions),
    blocks: num(stats?.tackles?.blocks),
    saves: num(stats?.goals?.saves),
    conceded: num(stats?.goals?.conceded),
    penaltySaved: num(stats?.penalty?.saved),
    foulsDrawn: num(stats?.fouls?.drawn),
  };
}

export function toPlayerMatchLines(raw: ApiFootballFixtureResultRaw): PlayerMatchLine[] {
  const sideOf = (teamId: number): MatchSide | null => (teamId === raw.teams.home.id ? "HOME" : teamId === raw.teams.away.id ? "AWAY" : null);
  return raw.players.flatMap(({ team, players }) => {
    const side = sideOf(team.id);
    if (!side) return [];
    return players.flatMap(({ player, statistics }) => {
      const stats = statistics[0];
      const minutes = num(stats?.games?.minutes);
      if (!minutes) return [];
      const pos = position(stats?.games?.position);
      const numbers = playerMatchNumbers(stats);
      if (pos === "G") numbers.conceded = keeperConceded(raw, player.id, team.id) ?? numbers.conceded;
      return [{ playerId: player.id, name: player.name, side, teamId: team.id, position: pos, minutes, rating: parseRating(stats?.games?.rating), numbers, xg: null }];
    });
  });
}
