import type { MatchPlayers, Side } from "./match-data";

/**
 * Kadro doğruluğu (kalıcı kural). Videodaki her oyuncu–takım eşleşmesi güncel kadro kaynağından doğrulanır. Eşleşme
 * ad üzerinden değil, API-Football oyuncu kimliği üzerinden. Önbellek en fazla 7 gün.
 */

export const SQUAD_MAX_AGE_DAYS = 7;
const DAY_MS = 86_400_000;

export function squadFreshness(checkedAt: string | null, now: Date): string | null {
  if (checkedAt === null) return "Kadro doğrulanamadı";
  const age = now.getTime() - new Date(checkedAt).getTime();
  return age > SQUAD_MAX_AGE_DAYS * DAY_MS ? `Kadro doğrulaması ${SQUAD_MAX_AGE_DAYS} günden eski` : null;
}

export const inSquad = (players: Pick<MatchPlayers, "squads">, side: Side, playerId: number): boolean =>
  players.squads[side].some((entry) => entry.id === playerId);

export interface SquadWarning {
  playerId: number;
  name: string;
  side: Side;
  message: string;
}

/** Aday listesinde olup kadroda olmayan oyuncular: videoya girmez, panelde uyarı. */
export function squadWarnings(players: MatchPlayers, teamNames: Record<Side, string>): SquadWarning[] {
  return (["home", "away"] as const).flatMap((side) =>
    players.candidates[side]
      .filter((player) => !inSquad(players, side, player.id))
      .map((player) => ({ playerId: player.id, name: player.name, side, message: `${player.name}, ${teamNames[side]} kadrosunda doğrulanamadı.` })),
  );
}
