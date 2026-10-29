import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directionIssues, unsampledClauses } from "@/lib/prediction/reason-claims";
import { auditedReasons, auditReason, matchSides, ruleReason, vitrinFacts } from "@/lib/prediction/reasons";
import { SCENARIO_REASONS_SYSTEM_PROMPT } from "@/lib/services/anthropic/scenario-reasons-prompt";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import type { DeepAnalysisStats, TeamDeepStats } from "@/types/deep-analysis";
import type { Scenario, ScenarioId, ScenarioOutcome } from "@/types/prediction";
import { SCENARIO_REASONS_OUTPUT } from "../fixtures/anthropic/scenario-reasons";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";

/** Konyaspor (ev; zayıf hücum) – Galatasaray (deplasman; formda) — sayılar bilerek ayrık. */
const base = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
const team = (name: string, form: Partial<TeamDeepStats["form"]>, counts: Pick<TeamDeepStats, "cleanSheets" | "failedToScore" | "over25Count">): TeamDeepStats => ({
  ...base,
  ...counts,
  form: { ...base.form, teamName: name, matchesSampled: 5, ...form },
});
const home = team("Konyaspor", { goalsForAvg: 0.8, goalsAgainstAvg: 1.8, last5: ["L", "L", "D", "L", "W"] }, { cleanSheets: 0, failedToScore: 2, over25Count: 3 });
const away = team("Galatasaray", { goalsForAvg: 2.2, goalsAgainstAvg: 0.6, last5: ["W", "W", "W", "D", "W"] }, { cleanSheets: 3, failedToScore: 0, over25Count: 2 });
const stats = {
  fixture: { homeTeam: { name: "Konyaspor" }, awayTeam: { name: "Galatasaray" }, competition: { name: "Süper Lig" } },
  home,
  away,
  headToHead: { matches: [], homeWins: 0, draws: 0, awayWins: 0 },
} as unknown as DeepAnalysisStats;
const facts = vitrinFacts(stats);
const sides = matchSides(stats);
const sample = () => 5;

const BTTS_YES: ScenarioOutcome = { scenario: "BTTS", pick: "YES" };
const BTTS_NO: ScenarioOutcome = { scenario: "BTTS", pick: "NO" };

describe("gerekçe yönü: seçili sonucu desteklemeli", () => {
  it("'İki takım da gol bulur mu? EVET' için az gol atmak reddedilir; HAYIR için destekler", () => {
    const reason = "Konyaspor son 5 maçta maç başı 0,8 gol attı.";
    assert.ok(directionIssues(reason, BTTS_YES, sides, sample).some((issue) => issue.includes("tersini söylüyor")));
    assert.deepEqual(directionIssues(reason, BTTS_NO, sides, sample), []);
    assert.deepEqual(directionIssues("Galatasaray son 5 maçta maç başı 2,2 gol attı.", BTTS_YES, sides, sample), []);
  });

  it("kullanıcının örneği tam denetimde iki sebeple reddedilir: örneklemsiz + ters yön", () => {
    const issues = auditReason("Konyaspor maç başı 0,8 gol atıyor.", BTTS_YES, facts, sides);
    assert.ok(issues.some((issue) => issue.startsWith("örneklem yok")), issues.join(" | "));
    assert.ok(issues.some((issue) => issue.includes("tersini söylüyor")), issues.join(" | "));
  });

  it("gollü maç: gol yemediği maçlar EVET'le çelişir, HAYIR'ı destekler", () => {
    const reason = "Galatasaray son 5 maçta 3 kez gol yemedi.";
    assert.ok(directionIssues(reason, { scenario: "GOALS_3PLUS", pick: "YES" }, sides, sample).length > 0);
    assert.deepEqual(directionIssues(reason, { scenario: "GOALS_3PLUS", pick: "NO" }, sides, sample), []);
  });

  it("kazanan: rakibin formu çelişir, seçilen tarafın formu ve rakibin zayıflığı destekler", () => {
    const home: ScenarioOutcome = { scenario: "RESULT_1X2", pick: "HOME" };
    const awayPick: ScenarioOutcome = { scenario: "RESULT_1X2", pick: "AWAY" };
    assert.ok(directionIssues("Galatasaray son 5 maçında 4 galibiyet aldı.", home, sides, sample).some((issue) => issue.includes("tersini")));
    assert.deepEqual(directionIssues("Galatasaray son 5 maçında 4 galibiyet aldı.", awayPick, sides, sample), []);
    assert.deepEqual(directionIssues("Konyaspor son 5 maçında 3 kez yenildi.", awayPick, sides, sample), []);
    // Takım adı geçmeyen cümlecik öznesini önceki cümlecikten alır.
    assert.ok(directionIssues("Galatasaray son 5 maçında 4 galibiyet aldı ve maç başı 2,2 gol attı.", home, sides, sample).length >= 2);
  });

  it("nötr veri tek başına desteklemez; beraberlik ve sayısız gerekçe yön denetimine girmez", () => {
    assert.ok(directionIssues("Galatasaray son 5 maçta maç başı 1,2 gol attı.", BTTS_YES, sides, sample).some((issue) => issue.includes("nötr")));
    assert.deepEqual(directionIssues("Galatasaray son 5 maçında 4 galibiyet aldı.", { scenario: "RESULT_1X2", pick: "DRAW" }, sides, sample), []);
    assert.deepEqual(directionIssues("Galatasaray maçlarında 3+ gol sık görülüyor.", { scenario: "GOALS_3PLUS", pick: "YES" }, sides, sample), []);
  });

  it("senaryo HAYIR: nötr kabul, iki koşulu birden destekleyen veri reddedilir", () => {
    const comboNo: ScenarioOutcome = { scenario: "COMBO", team: "AWAY", pick: "NO" };
    assert.deepEqual(directionIssues("Galatasaray son 5 maçında 3 kez gol atamadı.", comboNo, sides, sample), []);
    assert.ok(directionIssues("Galatasaray son 5 maçta maç başı 2,2 gol attı.", comboNo, sides, sample).length > 0);
  });
});

describe("örneklem: her sayının örneklemi yazılmalı", () => {
  it("örneklemsiz 'maç başı' reddedilir; 'son 5 maçta' ve 'bu sezon ligde' geçer", () => {
    assert.deepEqual(unsampledClauses("Konyaspor maç başı 0,8 gol atıyor.", sides), ["Konyaspor maç başı 0,8 gol atıyor"]);
    assert.deepEqual(unsampledClauses("Konyaspor son 5 maçta maç başı 0,8 gol attı.", sides), []);
    assert.deepEqual(unsampledClauses("Galatasaray bu sezon ligde maç başına 2,1 xG üretiyor.", sides), []);
    assert.deepEqual(unsampledClauses("Galatasaray üst üste 4 maç kazandı.", sides), []);
    assert.deepEqual(unsampledClauses("Galatasaray maçlarında 3+ gol sık görülüyor.", sides), []);
  });

  it("aynı öznenin cümleciği örneklemi devralır; diğer takımın cümleciği kendi örneklemini yazar", () => {
    assert.deepEqual(unsampledClauses("Galatasaray son 5 maçında 4 galibiyet aldı ve 2,2 gol attı.", sides), []);
    assert.deepEqual(unsampledClauses("Galatasaray son 5 maçında 4 galibiyet aldı; Konyaspor maç başı 1,8 gol yedi.", sides), ["Konyaspor maç başı 1,8 gol yedi"]);
  });
});

const scenario = (id: ScenarioId, outcome: ScenarioOutcome): Scenario => ({ id, outcome, probability: 0.6, outcomeProbabilities: {}, reason: "" });
const OUTCOMES: Scenario[] = [
  scenario("RESULT_1X2", { scenario: "RESULT_1X2", pick: "HOME" }),
  scenario("RESULT_1X2", { scenario: "RESULT_1X2", pick: "AWAY" }),
  scenario("RESULT_1X2", { scenario: "RESULT_1X2", pick: "DRAW" }),
  scenario("HT_RESULT", { scenario: "HT_RESULT", pick: "AWAY" }),
  ...(["BTTS", "GOALS_3PLUS", "GOALS_4PLUS"] as const).flatMap((id) => (["YES", "NO"] as const).map((pick) => scenario(id, { scenario: id, pick }))),
  ...(["HOME", "AWAY"] as const).flatMap((side) => (["YES", "NO"] as const).map((pick) => scenario("COMBO", { scenario: "COMBO", team: side, pick }))),
];

describe("kural tabanlı gerekçe aynı yön ve örneklem denetiminden geçer", () => {
  it("hiçbir sonuçta çelişen ya da örneklemsiz gerekçe üretmez; üretilen her gerekçe tam denetimi geçer", () => {
    for (const item of OUTCOMES) {
      const reason = ruleReason(item, facts, sides);
      const label = `${JSON.stringify(item.outcome)} → ${reason}`;
      assert.deepEqual(directionIssues(reason, item.outcome, sides, sample), [], label);
      assert.deepEqual(unsampledClauses(reason, sides), [], label);
      if (reason) assert.deepEqual(auditReason(reason, item.outcome, facts, sides), [], label);
    }
  });

  it("BTTS EVET: zayıf hücumlu Konyaspor değil, Galatasaray'ın golü yazılır (örneklemiyle)", () => {
    assert.equal(ruleReason(scenario("BTTS", BTTS_YES), facts, sides), "Galatasaray son 5 maçta maç başı 2,2 gol attı.");
  });
});

describe("AI gerekçeleri: denetimden geçmeyen kural tabanlı gerekçeye düşer", () => {
  const picks: Scenario[] = [
    scenario("RESULT_1X2", { scenario: "RESULT_1X2", pick: "AWAY" }),
    scenario("BTTS", BTTS_YES),
    scenario("GOALS_3PLUS", { scenario: "GOALS_3PLUS", pick: "YES" }),
    scenario("GOALS_4PLUS", { scenario: "GOALS_4PLUS", pick: "NO" }),
    scenario("HT_RESULT", { scenario: "HT_RESULT", pick: "AWAY" }),
    scenario("COMBO", { scenario: "COMBO", team: "AWAY", pick: "YES" }),
  ].map((item) => ({ ...item, reason: ruleReason(item, facts, sides) }));

  it("ters yönlü BTTS gerekçesi değişir (sebebiyle); geçenler AI metniyle kalır", () => {
    const { reasons, replaced } = auditedReasons(picks, SCENARIO_REASONS_OUTPUT, facts, sides);
    assert.deepEqual(replaced.map((item) => item.id), ["BTTS"]);
    assert.ok(replaced[0]!.issues.some((issue) => issue.includes("tersini söylüyor")));
    assert.equal(reasons.BTTS, undefined, "kural tabanlı gerekçe kullanılır");
    for (const id of ["RESULT_1X2", "GOALS_3PLUS", "GOALS_4PLUS", "HT_RESULT", "COMBO"] as const) assert.equal(reasons[id], SCENARIO_REASONS_OUTPUT[id], id);
    for (const item of picks.filter((p) => p.id !== "BTTS")) assert.deepEqual(auditReason(SCENARIO_REASONS_OUTPUT[item.id], item.outcome, facts, sides), [], item.id);
  });

  it("kural tabanlı gerekçe de geçmiyorsa AI metni kalır (denetim sorunu stüdyoda görünür, kart kilitlenir)", () => {
    const empty = picks.map((item) => ({ ...item, reason: "" }));
    const { reasons, replaced } = auditedReasons(empty, SCENARIO_REASONS_OUTPUT, facts, sides);
    assert.equal(replaced.length, 0);
    assert.equal(reasons.BTTS, SCENARIO_REASONS_OUTPUT.BTTS);
  });
});

describe("AI istemi yön ve örneklem kuralını taşır", () => {
  it("istemde yön kuralı, örneklem kuralı ve kullanıcının ret örneği var", () => {
    assert.match(SCENARIO_REASONS_SYSTEM_PROMPT, /Yön kuralı/u);
    assert.match(SCENARIO_REASONS_SYSTEM_PROMPT, /SEÇİLİ SONUCU DESTEKLEMELİ/u);
    assert.match(SCENARIO_REASONS_SYSTEM_PROMPT, /Örneklem kuralı/u);
    assert.match(SCENARIO_REASONS_SYSTEM_PROMPT, /Örneklemsiz "maç başı"/u);
    assert.ok(SCENARIO_REASONS_SYSTEM_PROMPT.includes("Konyaspor maç başı 0,8 gol atıyor."));
  });
});
