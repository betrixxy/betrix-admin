import type { DeepAnalysisStats } from "@/types/deep-analysis";
import type { Result } from "@/types/result";

/**
 * Maç önü "vitrin" kartının tahmin modeli (bkz. CLAUDE.md 1.10, `lib/prediction/`). Kart ve motor
 * tahminin hangi kaynaktan geldiğini bilmez; yalnızca `PredictionSet` okur (tak-çıkar kaynak).
 */

export const SCENARIO_IDS = ["RESULT_1X2", "BTTS", "GOALS_3PLUS", "GOALS_4PLUS", "HT_RESULT", "COMBO"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** Varsayılan açık kutular; admin stüdyoda değiştirebilir. */
export const DEFAULT_OPEN_SCENARIOS: readonly [ScenarioId, ScenarioId] = ["RESULT_1X2", "BTTS"];
export const OPEN_BOX_COUNT = 2;
export const LOCKED_BOX_COUNT = 3;
/** Gerekçe üst sınırı (karakter). */
export const REASON_MAX_LENGTH = 160;

/**
 * Makine okunur sonuç — maç bitince tuttu/tutmadı bununla hesaplanır. Taraf bu maçın ev sahibine
 * göredir. COMBO: "{taraf} kazanır VE maçta 3+ gol".
 */
export type SideOutcome = "HOME" | "DRAW" | "AWAY";
export type YesNo = "YES" | "NO";
export type ScenarioOutcome =
  | { scenario: "RESULT_1X2" | "HT_RESULT"; pick: SideOutcome }
  | { scenario: "BTTS" | "GOALS_3PLUS" | "GOALS_4PLUS"; pick: YesNo }
  | { scenario: "COMBO"; team: "HOME" | "AWAY"; pick: YesNo };

export interface Scenario {
  id: ScenarioId;
  /** Seçilen (en olası) sonuç. */
  outcome: ScenarioOutcome;
  /** Seçilen sonucun olasılığı, 0–1. */
  probability: number;
  /** Senaryonun bütün sonuçları ("HOME"/"DRAW"/"AWAY" ya da "YES"/"NO") → olasılık, 0–1. */
  outcomeProbabilities: Record<string, number>;
  /** ≤ REASON_MAX_LENGTH; boşsa henüz yazılmadı. */
  reason: string;
}

export interface PredictionSet {
  /** "internal" | "checkmatch-site" */
  sourceId: string;
  /** Modelin sürümü — kayıtta saklanır, karnede hangi modelin tuttuğu ayrılır. */
  sourceVersion: string;
  computedAtUtc: string;
  scenarios: Scenario[];
  /** "Modelimiz bu maç için {N} senaryo hesapladı." */
  scenarioCount: number;
  /** "En sürpriz olanı sadece %{p} ihtimalle…" — yüzde, tamsayı. Senaryonun kendisi kartta yazılmaz. */
  surprisePct: number;
}

export type PredictionErrorCode = "INSUFFICIENT_DATA" | "NOT_IMPLEMENTED" | "SOURCE_FAILED";

export interface PredictionError {
  code: PredictionErrorCode;
  message: string;
}

export interface PredictionInput {
  stats: DeepAnalysisStats;
}

/** Tak-çıkar tahmin kaynağı: iç model (`internal-source.ts`) ya da ileride checkmatch.net. */
export interface PredictionSource {
  id: string;
  predict(input: PredictionInput): Promise<Result<PredictionSet, PredictionError>>;
}
