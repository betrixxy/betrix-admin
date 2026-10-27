import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { DrawTeam, KnockoutTie, LeagueFixture } from "@/types/draw";

/**
 * API fikstüründen kura eşleşmeleri — saf. Kura sonrası karşılaştırma ve gerçek örnekler için:
 * lig aşaması (round "League Stage - N") → takım başına rakipler; eleme turu → iki ayaklı eşleşme
 * (ilk ayağın ev sahibi `first`). Takımların ülkesi fikstürde yok — çağıran `/teams` ile doldurur.
 */

const LEAGUE_STAGE = /League Stage|League Phase/i;

export function leagueFixturesFromApi(fixtures: ApiFootballFixtureRaw[], teamIds?: readonly number[]): LeagueFixture[] {
  const wanted = teamIds ? new Set(teamIds) : null;
  const out: LeagueFixture[] = [];
  const sorted = [...fixtures].filter((f) => LEAGUE_STAGE.test(f.league.round)).sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
  for (const fixture of sorted) {
    const { home, away } = fixture.teams;
    const date = new Date(fixture.fixture.timestamp * 1000).toISOString();
    if (!wanted || wanted.has(home.id)) out.push({ teamId: home.id, opponentId: away.id, venue: "HOME", dateUtc: date });
    if (!wanted || wanted.has(away.id)) out.push({ teamId: away.id, opponentId: home.id, venue: "AWAY", dateUtc: date });
  }
  return out;
}

/** Eleme turu: aynı iki takımın maçları tek eşleşme; ilk ayak (erken tarih) ev sahibi `first`. */
export function tiesFromApi(fixtures: ApiFootballFixtureRaw[], round: RegExp): KnockoutTie[] {
  const byPair = new Map<string, ApiFootballFixtureRaw[]>();
  for (const fixture of fixtures.filter((f) => round.test(f.league.round))) {
    const ids = [fixture.teams.home.id, fixture.teams.away.id].sort((a, b) => a - b);
    const key = ids.join("-");
    byPair.set(key, [...(byPair.get(key) ?? []), fixture]);
  }
  return [...byPair.values()].map((legs) => {
    const [first, second] = [...legs].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    const iso = (leg: ApiFootballFixtureRaw | undefined) => (leg ? new Date(leg.fixture.timestamp * 1000).toISOString() : null);
    return { first: first!.teams.home.id, second: first!.teams.away.id, firstLegUtc: iso(first), secondLegUtc: iso(second) };
  });
}

/** Fikstürlerdeki takımlar (ülke bilinmez → null; çağıran doldurur). */
export function teamsFromApi(fixtures: ApiFootballFixtureRaw[], countries: ReadonlyMap<number, string> = new Map()): DrawTeam[] {
  const teams = new Map<number, DrawTeam>();
  for (const fixture of fixtures) {
    for (const team of [fixture.teams.home, fixture.teams.away]) {
      if (!teams.has(team.id)) teams.set(team.id, { id: team.id, apiName: team.name, country: countries.get(team.id) ?? null, logoUrl: team.logo ?? null, pot: null });
    }
  }
  return [...teams.values()];
}
