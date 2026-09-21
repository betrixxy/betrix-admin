import type { CheckmatchMatchCalculationsRaw } from "@/lib/services/checkmatch-core/types";
import type { MatchCalculations } from "@/types/market";

export function mapCheckmatchCalculationsToMatchCalculations(
  raw: CheckmatchMatchCalculationsRaw,
): MatchCalculations {
  return {
    fixtureId: raw.fixture_id,
    computedAtUtc: raw.computed_at,
    markets: raw.markets.map((market) => ({
      market: market.market,
      selections: market.selections.map((selection) => ({
        label: selection.label,
        odds: selection.odds,
        probability: selection.probability,
      })),
    })),
  };
}
