import type { ScenarioReasonsOutput } from "@/lib/services/anthropic/types";

/**
 * Kurgusal Claude yanıtı — vitrin senaryo gerekçeleri (bkz. CLAUDE.md 5.2), Konyaspor (ev) – Galatasaray
 * (deplasman) olgu paketi için (`tests/unit/reason-direction.test.ts`). Bilerek tek hata: BTTS (seçili:
 * EVET) gerekçesi "Konyaspor maç başı 0,8 gol atıyor." — hem örneklemsiz hem sonucun tersini söylüyor.
 * Diğerleri seçili sonucu destekler ve denetimden geçmelidir.
 */
export const SCENARIO_REASONS_OUTPUT: ScenarioReasonsOutput = {
  RESULT_1X2: "Galatasaray son 5 maçında 4 galibiyet aldı.",
  BTTS: "Konyaspor maç başı 0,8 gol atıyor.",
  GOALS_3PLUS: "Konyaspor son 5 maçının 3 tanesinde 3+ gol gördü.",
  GOALS_4PLUS: "Galatasaray son 5 maçta 3 kez gol yemedi.",
  HT_RESULT: "Galatasaray son 5 maçta maç başı 0,6 gol yedi.",
  COMBO: "Galatasaray son 5 maçında 4 galibiyet aldı.",
};
