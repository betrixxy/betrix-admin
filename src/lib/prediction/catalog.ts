import type { Scenario, ScenarioId, ScenarioOutcome } from "@/types/prediction";

/**
 * Senaryo kataloğu — iç kimlik → kartta görünen dil (analiz ve senaryo dili; bahis dili YOK, bkz.
 * `banned-words.ts`). Kart ve gönderi metni başlık/etiketleri yalnızca buradan alır.
 */

export interface MatchSides {
  home: string;
  away: string;
}

/** Senaryonun kartta görünen başlığı. COMBO'da takım adı seçilen taraftan gelir. */
export function scenarioTitle(id: ScenarioId, sides: MatchSides, outcome?: ScenarioOutcome): string {
  switch (id) {
    case "RESULT_1X2":
      return "Kazanma olasılıkları";
    case "BTTS":
      return "İki takım da gol bulur mu?";
    case "GOALS_3PLUS":
      return "Gollü maç mı?";
    case "GOALS_4PLUS":
      return "Gol yağmuru var mı?";
    case "HT_RESULT":
      return "İlk yarı kimin?";
    case "COMBO": {
      const team = outcome?.scenario === "COMBO" && outcome.team === "AWAY" ? sides.away : sides.home;
      return `Senaryo: ${team} kazanır ve maçta 3+ gol olur`;
    }
  }
}

/** Sonuç anahtarının etiketi: "HOME" → ev sahibi adı, "DRAW" → "Beraberlik", "YES" → "Evet". */
export function outcomeLabel(key: string, sides: MatchSides): string {
  switch (key) {
    case "HOME":
      return sides.home;
    case "AWAY":
      return sides.away;
    case "DRAW":
      return "Beraberlik";
    case "YES":
      return "Evet";
    case "NO":
      return "Hayır";
    default:
      return key;
  }
}

/** Seçilen sonucun anahtarı ("HOME", "YES"…). */
export const outcomeKey = (outcome: ScenarioOutcome): string => outcome.pick;

/** 0–1 → "%64" (tamsayı yüzde). */
export const pct = (probability: number): string => `%${Math.round(probability * 100)}`;

/** Açık kutuda gösterilecek sonuç satırları: 1X2/ilk yarı üç taraf, diğerleri seçilen sonuç. */
export function openBoxLines(scenario: Scenario, sides: MatchSides): { label: string; value: string; picked: boolean }[] {
  const picked = outcomeKey(scenario.outcome);
  if (scenario.id === "RESULT_1X2" || scenario.id === "HT_RESULT") {
    return (["HOME", "DRAW", "AWAY"] as const).map((key) => ({ label: outcomeLabel(key, sides), value: pct(scenario.outcomeProbabilities[key] ?? 0), picked: key === picked }));
  }
  return [{ label: outcomeLabel(picked, sides), value: pct(scenario.probability), picked: true }];
}
