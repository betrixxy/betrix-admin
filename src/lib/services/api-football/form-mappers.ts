import { isFinishedStatus } from "@/lib/services/api-football/mappers";
import type { ApiFootballFixtureDetailRaw, ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { HeadToHeadSummary, MatchResultLetter, TeamRecentForm } from "@/types/sports";

/** Saf form/xG/H2H hesaplamaları — ağ yok, side-effect yok (bkz. CLAUDE.md 1.4, 5.2). */

export const RECENT_FORM_SIZE = 5;

/** Maç başlamadan önce oynanmış ve bitmiş maçları, eskiden yeniye sıralı döndürür. */
export function selectFinishedBefore<T extends ApiFootballFixtureRaw>(
  fixtures: T[],
  beforeUtc: string,
  limit: number,
): T[] {
  const cutoff = Date.parse(beforeUtc);
  return fixtures
    .filter((raw) => isFinishedStatus(raw.fixture.status.short) && raw.fixture.timestamp * 1000 < cutoff)
    .sort((a, b) => a.fixture.timestamp - b.fixture.timestamp)
    .slice(-limit);
}

interface TeamGoals {
  scored: number;
  conceded: number;
}

function goalsFor(raw: ApiFootballFixtureRaw, teamId: number): TeamGoals | null {
  const { home, away } = raw.goals;
  if (home === null || away === null) return null;
  const isHome = raw.teams.home.id === teamId;
  return isHome ? { scored: home, conceded: away } : { scored: away, conceded: home };
}

function resultLetter(goals: TeamGoals): MatchResultLetter {
  if (goals.scored > goals.conceded) return "W";
  if (goals.scored < goals.conceded) return "L";
  return "D";
}

/** "2.05" gibi string ya da sayı gelen `expected_goals` değerini okur; yoksa null. */
function readExpectedGoals(raw: ApiFootballFixtureDetailRaw, teamId: number): number | null {
  const row = raw.statistics.find((entry) => entry.team.id === teamId);
  const value = row?.statistics.find((stat) => stat.type === "expected_goals")?.value;
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Takımın son maçlarından form dizisi, gol ve xG ortalamalarını hesaplar. `fixtures`
 * eskiden yeniye sıralı ve yalnızca bitmiş maçlardan oluşmalıdır (bkz. selectFinishedBefore).
 */
export function computeRecentForm(
  fixtures: ApiFootballFixtureDetailRaw[],
  team: { id: number; name: string; logoUrl: string },
): TeamRecentForm {
  const goals = fixtures.map((raw) => goalsFor(raw, team.id)).filter((g): g is TeamGoals => g !== null);

  const xgFor: number[] = [];
  const xgAgainst: number[] = [];
  for (const raw of fixtures) {
    const opponentId = raw.teams.home.id === team.id ? raw.teams.away.id : raw.teams.home.id;
    const own = readExpectedGoals(raw, team.id);
    const opponent = readExpectedGoals(raw, opponentId);
    // Bir maç ancak iki taraf için de xG varsa ortalamaya girer — xG/xGA aynı örneklemden gelir.
    if (own !== null && opponent !== null) {
      xgFor.push(own);
      xgAgainst.push(opponent);
    }
  }

  return {
    teamId: String(team.id),
    teamName: team.name,
    logoUrl: team.logoUrl,
    last5: goals.map(resultLetter),
    matchesSampled: goals.length,
    goalsForAvg: average(goals.map((g) => g.scored)),
    goalsAgainstAvg: average(goals.map((g) => g.conceded)),
    xgForAvg: average(xgFor),
    xgAgainstAvg: average(xgAgainst),
    xgMatchesSampled: xgFor.length,
  };
}

/** Son karşılaşmaları, bu maçın ev sahibi (`homeTeamId`) açısından özetler. */
export function computeHeadToHead(fixtures: ApiFootballFixtureRaw[], homeTeamId: number): HeadToHeadSummary {
  const summary: HeadToHeadSummary = { matches: [], homeWins: 0, draws: 0, awayWins: 0 };

  for (const raw of fixtures) {
    const goals = goalsFor(raw, homeTeamId);
    if (!goals || raw.goals.home === null || raw.goals.away === null) continue;

    const letter = resultLetter(goals);
    if (letter === "W") summary.homeWins += 1;
    else if (letter === "L") summary.awayWins += 1;
    else summary.draws += 1;

    summary.matches.push({
      kickoffUtc: new Date(raw.fixture.date).toISOString(),
      homeTeamName: raw.teams.home.name,
      awayTeamName: raw.teams.away.name,
      homeGoals: raw.goals.home,
      awayGoals: raw.goals.away,
    });
  }

  return summary;
}
