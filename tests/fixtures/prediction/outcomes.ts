import type { ScenarioId, ScenarioOutcome } from "@/types/prediction";

/** Denetim testlerinin varsayılan seçili sonuçları: ev sahibi kazanır / evet (yön denetimi bunlara göre). */
export const PICK = {
  RESULT_1X2: { scenario: "RESULT_1X2", pick: "HOME" },
  HT_RESULT: { scenario: "HT_RESULT", pick: "HOME" },
  BTTS: { scenario: "BTTS", pick: "YES" },
  GOALS_3PLUS: { scenario: "GOALS_3PLUS", pick: "YES" },
  GOALS_4PLUS: { scenario: "GOALS_4PLUS", pick: "YES" },
  COMBO: { scenario: "COMBO", team: "HOME", pick: "YES" },
} as const satisfies Record<ScenarioId, ScenarioOutcome>;
