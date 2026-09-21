/**
 * Mac sunucusundan (checkmatch-core, bkz. CLAUDE.md 1.4 servis katmanı) gelen
 * hesaplanmış oran/market verisinin kanonik iç modeli — bkz. 2.2 stili.
 */

export interface MarketSelection {
  label: string;
  odds: number;
  probability: number;
}

export interface MarketCalculation {
  market: string;
  selections: MarketSelection[];
}

export interface MatchCalculations {
  fixtureId: string;
  computedAtUtc: string;
  markets: MarketCalculation[];
}
