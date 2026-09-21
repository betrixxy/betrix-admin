import type { SportmonksFixtureSummary, SportmonksTeamRaw } from "@/lib/services/sportmonks/types";
import type { MatchResultLetter, TeamForm } from "@/types/sports";

/**
 * Sportmonks `type_id` -> metrik eşlemesi. Bu değerler doğrulanana kadar YER TUTUCUDUR;
 * gerçek anahtarla yapılacak ilk çağrıda hesabın Sportmonks "type reference" tablosuyla
 * karşılaştırılıp düzeltilmelidir (bkz. types.ts başındaki not).
 */
export const SPORTMONKS_STAT_TYPE_IDS = {
  EXPECTED_GOALS_FOR: 5304,
  EXPECTED_GOALS_AGAINST: 5305,
  DANGEROUS_ATTACKS_AVG: 5306,
} as const;

function readNumericStat(
  details: Array<{ type_id: number; value: unknown }>,
  typeId: number,
): number {
  const detail = details.find((d) => d.type_id === typeId);
  if (!detail) return 0;
  if (typeof detail.value === "number") return detail.value;
  if (detail.value && typeof detail.value === "object" && "average" in detail.value) {
    const average = (detail.value as { average?: unknown }).average;
    return typeof average === "number" ? average : 0;
  }
  return 0;
}

function deriveResultLetter(
  fixture: SportmonksFixtureSummary,
  teamId: number,
): MatchResultLetter | null {
  const participant = fixture.participants?.find((p) => p.id === teamId);
  const location = participant?.meta?.location;
  const currentScores = fixture.scores?.filter((s) => s.description === "CURRENT");
  if (!location || !currentScores || currentScores.length < 2) return null;

  const ownGoals = currentScores.find((s) => s.score.participant === location)?.score.goals;
  const opponentGoals = currentScores.find((s) => s.score.participant !== location)?.score.goals;
  if (ownGoals === undefined || opponentGoals === undefined) return null;

  if (ownGoals > opponentGoals) return "W";
  if (ownGoals < opponentGoals) return "L";
  return "D";
}

/**
 * Ham Sportmonks takım verisini kanonik `TeamForm`'a çevirir. Saf fonksiyon, side-effect
 * içermez (bkz. CLAUDE.md 1.4).
 */
export function mapSportmonksTeamToForm(raw: SportmonksTeamRaw): TeamForm {
  const last5 = (raw.latest ?? [])
    .slice(0, 5)
    .map((fixture) => deriveResultLetter(fixture, raw.id))
    .filter((letter): letter is MatchResultLetter => letter !== null);

  const details = raw.statistics?.[0]?.details ?? [];

  return {
    teamId: String(raw.id),
    last5,
    xgFor: readNumericStat(details, SPORTMONKS_STAT_TYPE_IDS.EXPECTED_GOALS_FOR),
    xgAgainst: readNumericStat(details, SPORTMONKS_STAT_TYPE_IDS.EXPECTED_GOALS_AGAINST),
    dangerousAttacksAvgPerMatch: readNumericStat(
      details,
      SPORTMONKS_STAT_TYPE_IDS.DANGEROUS_ATTACKS_AVG,
    ),
  };
}
