import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVitrinCaption, reasonKey } from "@/lib/dashboard/vitrin-caption";
import { auditReason, matchSides, ruleReason, ruleReasons, vitrinFacts } from "@/lib/prediction/reasons";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import type { DeepAnalysisStats, TeamDeepStats } from "@/types/deep-analysis";
import type { Scenario, ScenarioId, ScenarioOutcome } from "@/types/prediction";
import type { VitrinCard } from "@/types/vitrin";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";

/**
 * Vitrin kural tabanlı gerekçeleri kutuya özgü (2026-10-30): ANTHROPIC anahtarı yokken "Kazanma olasılıkları"
 * ve "İki takım da gol bulur mu?" kutularına AYNI cümle ("Fenerbahçe son 5 maçta maç başı 1,8 gol attı.")
 * yazılıyor, gönderi metninde de tekrar ediyordu. Kurgusal sayılar.
 */

const base = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
const team = (name: string, form: Partial<TeamDeepStats["form"]>, counts: Pick<TeamDeepStats, "cleanSheets" | "failedToScore" | "over25Count" | "bttsCount">): TeamDeepStats => ({
  ...base,
  ...counts,
  form: { ...base.form, teamName: name, matchesSampled: 5, ...form },
});
const statsWith = (bttsHome: number) =>
  ({
    fixture: { homeTeam: { name: "Fenerbahçe" }, awayTeam: { name: "Samsunspor" }, competition: { name: "Süper Lig" } },
    // Fenerbahçe: 2 galibiyet (nötr — form parçası desteklemez), maç başı 1,8 gol → iki senaryoda da ilk destekleyen parça.
    home: team("Fenerbahçe", { goalsForAvg: 1.8, goalsAgainstAvg: 1.2, last5: ["W", "D", "L", "W", "D"] }, { cleanSheets: 1, failedToScore: 0, over25Count: 3, bttsCount: bttsHome }),
    away: team("Samsunspor", { goalsForAvg: 1.4, goalsAgainstAvg: 1.6, last5: ["L", "W", "D", "L", "W"] }, { cleanSheets: 0, failedToScore: 1, over25Count: 3, bttsCount: 3 }),
    headToHead: { matches: [], homeWins: 0, draws: 0, awayWins: 0 },
  }) as unknown as DeepAnalysisStats;

const scenario = (id: ScenarioId, outcome: ScenarioOutcome): Scenario => ({ id, outcome, probability: 0.6, outcomeProbabilities: {}, reason: "" });
const CATALOG: Scenario[] = [
  scenario("RESULT_1X2", { scenario: "RESULT_1X2", pick: "HOME" }),
  scenario("BTTS", { scenario: "BTTS", pick: "YES" }),
  scenario("GOALS_3PLUS", { scenario: "GOALS_3PLUS", pick: "YES" }),
  scenario("GOALS_4PLUS", { scenario: "GOALS_4PLUS", pick: "NO" }),
  scenario("HT_RESULT", { scenario: "HT_RESULT", pick: "HOME" }),
  scenario("COMBO", { scenario: "COMBO", team: "HOME", pick: "YES" }),
];

describe("kural tabanlı gerekçe kutuya özgü", () => {
  const stats = statsWith(2);
  const facts = vitrinFacts(stats);
  const sides = matchSides(stats);

  it("regresyon: 1,8 gol parçası iki senaryoyu da destekler; kullanılmışsa ikinci kutuya yazılmaz", () => {
    const result = ruleReason(CATALOG[0]!, facts, sides);
    assert.equal(result, "Fenerbahçe son 5 maçta maç başı 1,8 gol attı.");
    // Aynı parça "İki takım da gol bulur mu? EVET"i de destekler (eskiden ikinci kutuya da yazılıyordu).
    assert.deepEqual(auditReason(result, CATALOG[1]!.outcome, facts, sides), []);
    assert.notEqual(ruleReason(CATALOG[1]!, facts, sides, new Set([result.replace(/.$/u, "")])), result);
  });

  it("ruleReasons: dolu gerekçeler birbirinden farklı, her biri tam denetimden geçer", () => {
    const reasons = ruleReasons(CATALOG, facts, sides);
    assert.equal(reasons[0], "Fenerbahçe son 5 maçta maç başı 1,8 gol attı.");
    assert.notEqual(reasons[1], reasons[0]);
    const filled = reasons.filter(Boolean);
    assert.equal(new Set(filled.map(reasonKey)).size, filled.length, filled.join(" | "));
    reasons.forEach((reason, index) => {
      const item = CATALOG[index]!;
      if (reason) assert.deepEqual(auditReason(reason, item.outcome, facts, sides), [], `${item.id}: ${reason}`);
    });
    // Parça düzeyinde de tekrar yok (birleşik gerekçeler dahil).
    const parts = filled.flatMap((reason) => reason.replace(/\.$/u, "").split("; "));
    assert.equal(new Set(parts).size, parts.length);
  });

  it("'İki takım da gol bulur mu? EVET' kendi verisiyle: iki takımın da gol bulduğu maçlar (≥ %60)", () => {
    const rich = statsWith(4);
    const reasons = ruleReasons(CATALOG, vitrinFacts(rich), matchSides(rich));
    assert.equal(reasons[1], "Fenerbahçe son 5 maçının 4'ünde iki takım da gol buldu.");
    assert.deepEqual(auditReason(reasons[1] ?? "", CATALOG[1]!.outcome, vitrinFacts(rich), matchSides(rich)), []);
  });
});

describe("gönderi metni: aynı gerekçe iki kez yazılmaz (güvenlik ağı)", () => {
  const box = (title: string, reason: string) => ({ title, lines: [{ label: "Evet", value: "%58", picked: true }], reason });
  const card = {
    names: { home: "Fenerbahçe", away: "Samsunspor", competition: "Trendyol Süper Lig", round: "10. Hafta" },
    open: [box("Kazanma olasılıkları", "Fenerbahçe son 5 maçta maç başı 1,8 gol attı."), box("İki takım da gol bulur mu?", "fenerbahçe son 5 maçta maç başı 1,8 gol attı ")],
    hook: ["Modelimiz bu maç için 12 senaryo hesapladı.", "En sürpriz olanı sadece %4 ihtimalle gerçekleşiyor — tamamı checkmatch.net'te."],
  } as unknown as VitrinCard;

  it("ikinci kutuda tekrar eden gerekçe atlanır, başlık ve yüzdeler kalır", () => {
    const caption = buildVitrinCaption(card);
    assert.equal(caption.split("maç başı 1,8 gol attı").length - 1, 1, caption);
    assert.match(caption, /📊 İki takım da gol bulur mu\?: Evet %58/u);
  });
});
