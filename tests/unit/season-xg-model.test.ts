import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { predictInternal } from "@/lib/prediction/internal-source";
import { expectedGoals, LEGACY_MODEL_VERSION, MODEL_VERSION } from "@/lib/prediction/poisson";
import { auditReason, matchSides, vitrinFacts } from "@/lib/prediction/reasons";
import { predictionRecordsFor, recordModelVersion } from "@/lib/prediction/record";
import { DIFFERENT_LEAGUES_WARNING, differentLeagues, modelForm, SEASON_XG_MIN_MATCHES } from "@/lib/prediction/season-xg";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import type { DeepAnalysisStats, SeasonLeagueXg, TeamDeepStats } from "@/types/deep-analysis";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";
import { PICK } from "../fixtures/prediction/outcomes";

/**
 * Model v2 ("v2-season-xg"): Poisson'un xG girdisi bu sezonun lig maçlarından (≥5), yoksa yalnızca
 * gol; farklı liglerde uyarı + gerekçede xG kıyası yok; tahmin kaydında model sürümü.
 */

const league = (leagueId: number, matchesSampled: number, xgForAvg: number, xgAgainstAvg: number): SeasonLeagueXg => ({
  leagueId,
  leagueName: leagueId === 203 ? "Süper Lig" : "Czech Liga",
  season: 2026,
  matchesSampled,
  xgForAvg,
  xgAgainstAvg,
});

const base = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
// Son 5 maçın xG'si bilerek uçuk (3,5) — modele girmemeli.
const team = (name: string, seasonLeagueXg: SeasonLeagueXg | null): TeamDeepStats => ({
  ...base,
  form: { ...base.form, teamName: name, goalsForAvg: 1.5, goalsAgainstAvg: 1, xgForAvg: 3.5, xgAgainstAvg: 0.2 },
  seasonLeagueXg,
});
const statsOf = (home: TeamDeepStats, away: TeamDeepStats) =>
  ({
    fixture: { homeTeam: { name: "Fenerbahçe" }, awayTeam: { name: "Slavia Praha" }, competition: { name: "UEFA Champions League" } },
    home,
    away,
    headToHead: { matches: [], homeWins: 0, draws: 0, awayWins: 0 },
  }) as unknown as DeepAnalysisStats;

describe("model girdisi: sezon lig xG'si", () => {
  it(`≥ ${SEASON_XG_MIN_MATCHES} lig maçı: xG sezon liginden; son 5 maçın xG'si kullanılmaz; gol son 5'ten`, () => {
    const form = modelForm(team("Fenerbahçe", league(203, 8, 2.34, 1.15)));
    assert.equal(form.xgForAvg, 2.34);
    assert.equal(form.xgAgainstAvg, 1.15);
    assert.equal(form.goalsForAvg, 1.5);
  });

  it(`< ${SEASON_XG_MIN_MATCHES} lig maçı ya da lig yok: xG null → yalnızca gol`, () => {
    for (const season of [league(203, SEASON_XG_MIN_MATCHES - 1, 2.9, 0.8), null]) {
      const form = modelForm(team("Fenerbahçe", season));
      assert.equal(form.xgForAvg, null);
      assert.equal(form.xgAgainstAvg, null);
    }
    const goalsOnly = expectedGoals(modelForm(team("A", null)), modelForm(team("B", null)));
    const plain = expectedGoals({ ...base.form, goalsForAvg: 1.5, goalsAgainstAvg: 1, xgForAvg: null, xgAgainstAvg: null }, { ...base.form, goalsForAvg: 1.5, goalsAgainstAvg: 1, xgForAvg: null, xgAgainstAvg: null });
    assert.deepEqual(goalsOnly, plain);
  });

  it("predictInternal sezon lig xG'siyle hesaplar ve sürüm v2-season-xg yazar", () => {
    const stats = statsOf(team("Fenerbahçe", league(203, 8, 2.34, 1.15)), team("Slavia Praha", league(345, 11, 2.36, 0.89)));
    const result = predictInternal(stats);
    assert.ok(result.ok);
    assert.equal(result.data.sourceVersion, MODEL_VERSION);
    assert.equal(MODEL_VERSION, "v2-season-xg");
    const expected = expectedGoals(modelForm(stats.home), modelForm(stats.away));
    const recent = expectedGoals(stats.home.form, stats.away.form);
    assert.notDeepEqual(expected, recent, "son 5 maçın xG'si girseydi sonuç farklı olurdu");
    const v1 = predictInternal(statsOf(team("Fenerbahçe", null), team("Slavia Praha", null)));
    assert.ok(v1.ok);
    assert.notEqual(result.data.scenarios[0]!.probability, v1.data.scenarios[0]!.probability);
  });
});

describe("farklı ligler", () => {
  const cross = statsOf(team("Fenerbahçe", league(203, 8, 2.34, 1.15)), team("Slavia Praha", league(345, 11, 2.36, 0.89)));
  const same = statsOf(team("Fenerbahçe", league(203, 8, 2.34, 1.15)), team("Slavia Praha", league(203, 8, 1.4, 1.3)));
  const sides = matchSides(cross);

  it("yalnızca iki lig de biliniyor ve farklıysa; uyarı metni sabit", () => {
    assert.equal(differentLeagues(cross), true);
    assert.equal(differentLeagues(same), false);
    assert.equal(differentLeagues(statsOf(team("A", league(203, 8, 1, 1)), team("B", null))), false);
    assert.equal(DIFFERENT_LEAGUES_WARNING, "Farklı ligler: xG doğrudan karşılaştırılamaz");
    assert.equal(vitrinFacts(cross).mac.farkli_ligler, true);
    assert.equal(vitrinFacts(same).mac.farkli_ligler, false);
  });

  it("iki takımın xG'sini aynı cümlede kıyaslayan gerekçe reddedilir; tek takımın xG'si geçer", () => {
    const facts = vitrinFacts(cross);
    const compare = [
      "Fenerbahçe ve Slavia Prag bu sezon ligde 2,34 ile 2,36 xG üretiyor.",
      "Fenerbahçe bu sezon ligde rakibinden daha fazla xG üretiyor.",
      "İki takım da bu sezon ligde yüksek xG üretiyor.",
    ];
    for (const reason of compare) {
      assert.ok(auditReason(reason, PICK.GOALS_3PLUS, facts, sides).includes("farklı ligler: iki takımın xG'si kıyaslanamaz"), reason);
    }
    assert.deepEqual(auditReason("Fenerbahçe bu sezon ligde maç başına 2,34 xG üretiyor.", PICK.GOALS_3PLUS, facts, sides), []);
    // xG'siz kıyas serbest (yalnızca xG kıyaslanamaz).
    assert.ok(!auditReason("Fenerbahçe ve Slavia Praha son 5 maçta gol buldu.", PICK.BTTS, facts, sides).some((issue) => issue.startsWith("farklı ligler")));
  });

  it("aynı ligde iki takımın xG kıyası serbest", () => {
    const facts = vitrinFacts(same);
    const issues = auditReason("Fenerbahçe ve Slavia Praha bu sezon ligde 2,34 ile 1,4 xG üretiyor.", PICK.GOALS_3PLUS, facts, matchSides(same));
    assert.ok(!issues.some((issue) => issue.startsWith("farklı ligler")), issues.join(" | "));
  });
});

describe("tahmin kaydı: model sürümü", () => {
  const prediction = (sourceVersion: string, sourceId = "internal") => ({
    sourceId,
    sourceVersion,
    computedAtUtc: "2026-10-27T10:00:00.000Z",
    scenarios: [{ id: "RESULT_1X2" as const, outcome: { scenario: "RESULT_1X2" as const, pick: "HOME" as const }, probability: 0.5, outcomeProbabilities: { HOME: 0.5, DRAW: 0.25, AWAY: 0.25 }, reason: "r" }],
    scenarioCount: 10,
    surprisePct: 3,
  });

  it("v2 ile hesaplanan → 'v2-season-xg'; v1 ile hesaplanıp sonra onaylanan → null (= v1); dış kaynak → null", () => {
    assert.equal(recordModelVersion(prediction(MODEL_VERSION)), "v2-season-xg");
    assert.equal(recordModelVersion(prediction(LEGACY_MODEL_VERSION)), null);
    assert.equal(recordModelVersion(prediction("site-2026.10", "checkmatch-site")), null);
  });

  it("kayıt satırı modelVersion taşır", () => {
    const [row] = predictionRecordsFor("ai-1", "api-football-1", { open: ["RESULT_1X2", "RESULT_1X2"], prediction: prediction(MODEL_VERSION) });
    assert.equal(row!.modelVersion, "v2-season-xg");
    assert.equal(row!.sourceVersion, "v2-season-xg");
  });
});
