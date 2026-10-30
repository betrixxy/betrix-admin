import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { toPlayerMatchLines } from "@/lib/services/api-football/player-match-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { PlayerStatsFacts, SportmonksLineupPlayer } from "@/types/player-match-stats";
import { playerDataSettlement } from "./settle";
import { withSportmonksXg } from "./xg";

/**
 * Saf: ham bitmiş maç (+ varsa Sportmonks dizilişi) → `PlayerStatsFacts`. Maç bilgisi (skor, golcüler, MVP)
 * Maç Sonucu ile AYNI eşlemeden (`toMatchResultFacts`) gelir — set kartları birbiriyle çelişemez. Bitmemiş
 * maçta null.
 */
export function assemblePlayerStatsFacts(
  raw: ApiFootballFixtureResultRaw,
  now: Date,
  sportmonks: { players: SportmonksLineupPlayer[]; ids: { home: number; away: number } } | null,
): PlayerStatsFacts | null {
  const match = toMatchResultFacts(raw);
  if (!match) return null;
  const base = toPlayerMatchLines(raw);
  const xg = sportmonks ? withSportmonksXg(base, sportmonks.players, sportmonks.ids) : { lines: base, matched: 0 };
  return {
    match,
    lines: xg.lines,
    settlement: playerDataSettlement({ kickoffUtc: match.kickoffUtc, statusShort: match.statusShort, lines: base, now }),
    sportmonksMatched: sportmonks !== null,
    xgMatched: xg.matched,
  };
}
