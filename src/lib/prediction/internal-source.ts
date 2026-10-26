import type { DeepAnalysisStats } from "@/types/deep-analysis";
import type { PredictionError, PredictionSet, PredictionSource, Scenario, SideOutcome, YesNo } from "@/types/prediction";
import type { Result } from "@/types/result";
import { expectedGoals, matchProbabilities, MIN_MATCHES, MODEL_VERSION, type MatchProbabilities } from "./poisson";
import { modelForm } from "./season-xg";

/**
 * İç tahmin kaynağı — mevcut AI Market veri türetimi (`getDeepAnalysisStats`) + Poisson modeli
 * (`poisson.ts`). Saf: aynı veri aynı seti üretir (yalnızca `computedAtUtc` değişir). Gerekçeleri
 * burası yazmaz (boş gelir); denetimli AI analist ya da kural tabanlı yedek doldurur (`reasons.ts`).
 */

export const INTERNAL_SOURCE_ID = "internal";
/** "Kayda değer" en sürpriz senaryonun alt sınırı (olasılık). */
export const SURPRISE_MIN = 0.03;
/** Senaryo sayımına giren kesin skorun alt sınırı (olasılık). */
export const EXACT_SCORE_MIN = 0.01;

const bestOf = <K extends string>(entries: Record<K, number>): K => (Object.entries(entries) as [K, number][]).reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
const yesNo = (yes: number): { pick: YesNo; probability: number; outcomeProbabilities: Record<string, number> } => ({
  pick: yes >= 0.5 ? "YES" : "NO",
  probability: yes >= 0.5 ? yes : 1 - yes,
  outcomeProbabilities: { YES: yes, NO: 1 - yes },
});

/** Olasılıklar → 6 senaryo (seçilen = en olası sonuç; COMBO'nun takımı favori taraf). */
export function scenariosFrom(p: MatchProbabilities): Scenario[] {
  const result: SideOutcome = bestOf(p.result);
  const halfTime: SideOutcome = bestOf(p.halfTime);
  const favourite = p.result.HOME >= p.result.AWAY ? "HOME" : "AWAY";
  const btts = yesNo(p.btts);
  const three = yesNo(p.goals3plus);
  const four = yesNo(p.goals4plus);
  const combo = yesNo(p.combo[favourite]);
  return [
    { id: "RESULT_1X2", outcome: { scenario: "RESULT_1X2", pick: result }, probability: p.result[result], outcomeProbabilities: { ...p.result }, reason: "" },
    { id: "BTTS", outcome: { scenario: "BTTS", pick: btts.pick }, probability: btts.probability, outcomeProbabilities: btts.outcomeProbabilities, reason: "" },
    { id: "GOALS_3PLUS", outcome: { scenario: "GOALS_3PLUS", pick: three.pick }, probability: three.probability, outcomeProbabilities: three.outcomeProbabilities, reason: "" },
    { id: "GOALS_4PLUS", outcome: { scenario: "GOALS_4PLUS", pick: four.pick }, probability: four.probability, outcomeProbabilities: four.outcomeProbabilities, reason: "" },
    { id: "HT_RESULT", outcome: { scenario: "HT_RESULT", pick: halfTime }, probability: p.halfTime[halfTime], outcomeProbabilities: { ...p.halfTime }, reason: "" },
    { id: "COMBO", outcome: { scenario: "COMBO", team: favourite, pick: combo.pick }, probability: combo.probability, outcomeProbabilities: combo.outcomeProbabilities, reason: "" },
  ];
}

/**
 * Kancanın sayıları: N = katalog senaryolarının bütün sonuçları + olasılığı ≥ %1 olan kesin skorlar;
 * en sürpriz = bu sonuçlardan olasılığı ≥ %3 olanların en düşüğü (yüzde, tamsayı).
 */
export function scenarioSummary(scenarios: Scenario[], p: MatchProbabilities): { scenarioCount: number; surprisePct: number } {
  const outcomes = [...scenarios.flatMap((scenario) => Object.values(scenario.outcomeProbabilities)), ...p.exactScores.map((score) => score.probability)].filter(
    (probability) => probability >= EXACT_SCORE_MIN,
  );
  const notable = outcomes.filter((probability) => probability >= SURPRISE_MIN);
  const surprise = notable.length ? Math.min(...notable) : SURPRISE_MIN;
  return { scenarioCount: outcomes.length, surprisePct: Math.max(1, Math.round(surprise * 100)) };
}

export function predictInternal(stats: DeepAnalysisStats, now = new Date()): Result<PredictionSet, PredictionError> {
  // Gol/form son 5 maçtan, xG bu sezonun lig maçlarından (≥5; yoksa yalnızca gol).
  const goals = expectedGoals(modelForm(stats.home), modelForm(stats.away));
  if (!goals) {
    return { ok: false, error: { code: "INSUFFICIENT_DATA", message: `Tahmin için iki takımın da en az ${MIN_MATCHES} maçlık gol verisi gerekiyor — kart üretilmedi.` } };
  }
  const probabilities = matchProbabilities(goals);
  const scenarios = scenariosFrom(probabilities);
  return {
    ok: true,
    data: { sourceId: INTERNAL_SOURCE_ID, sourceVersion: MODEL_VERSION, computedAtUtc: now.toISOString(), scenarios, ...scenarioSummary(scenarios, probabilities) },
  };
}

export const internalSource: PredictionSource = {
  id: INTERNAL_SOURCE_ID,
  predict: async ({ stats }) => predictInternal(stats),
};
