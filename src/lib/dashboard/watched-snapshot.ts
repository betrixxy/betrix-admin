import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";
import type { Fixture } from "@/types/sports";

/** Yıldız anlık görüntüsü (`WatchedFixture`) — saf; bkz. `watched-fixtures.ts`. */

/** Kanonik yarışma kimliği → API-Football lig kimliği (desteklenen liglerde iç kimlik kullanılır). */
export function apiFootballLeagueId(competitionId: string): number | null {
  const supported = SUPPORTED_LEAGUES.find((league) => league.id === competitionId);
  if (supported) return supported.apiFootballId;
  const numeric = Number(competitionId);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

/** Saf: maç → `WatchedFixture` anlık görüntüsü. */
export function watchSnapshot(fixture: Fixture) {
  return {
    kickoffUtc: new Date(fixture.kickoffUtc),
    homeName: fixture.homeTeam.name,
    homeLogo: fixture.homeTeam.logoUrl,
    awayName: fixture.awayTeam.name,
    awayLogo: fixture.awayTeam.logoUrl,
    leagueId: apiFootballLeagueId(fixture.competition.id),
    leagueName: fixture.competition.shortName,
    round: fixture.details?.round ?? null,
  };
}
