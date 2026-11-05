import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DERBY } from "../src/samples";
import { matchDataFromContract, type ContractDetail, type FrozenExtras } from "../src/story/from-contract";
import { BRAND, evaluatePool } from "../src/story/pool";

const detail: ContractDetail = {
  contract_version: "1.0",
  match: { id: 1, kickoff_utc: "2026-11-08T17:00:00Z", league: { id: 203, name: "Super Lig", round: "Regular Season - 12" }, referee: null },
  model: { version: "2.1.0", computed_at: "2026-11-08T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.5, draw: 0.3, away_win: 0.2 },
  score_distribution: [],
  score_scene_allowed: false,
  goals: { three_plus: 0.5 },
  recent_xg: { home: 1.2, away: 0.9 },
  both_score: 0.55,
  first_goal: { home: 0.5, away: 0.4, none: 0.1 },
  form: { home: "WWDLW", away: null },
  h2h: { played: 2, home_wins: 1, draws: 0, away_wins: 1 },
};
const extras: FrozenExtras = {
  league_name: "Trendyol Süper Lig", round: "12. Hafta", venue: "Arena", referee: "Hakem", teams: DERBY.teams, players: DERBY.players, context: DERBY.context,
  h2h_matches: [{ date: "2026-01-01", home: "A", away: "B", home_score: 2, away_score: 1 }, { date: "2025-01-01", home: "B", away: "A", home_score: 0, away_score: 0 }],
};

describe("sözleşme v1 uyarlayıcısı", () => {
  const data = matchDataFromContract(detail, extras);
  it("v1'de olmayan alan uydurulmaz", () => {
    assert.equal(data.outcome_double, null);
    assert.equal(data.goals.two_plus, null);
    assert.equal(data.goals.three_plus, 0.5);
    assert.equal(data.penalty, null);
    assert.deepEqual(data.scorer_chances, []);
    assert.equal(data.form.home.goals_for, null);
    assert.equal(data.model_track_record, null);
  });
  it("kart adları ve kafa kafaya ortalaması dondurulan veriden", () => {
    assert.equal(data.match.league.name, "Trendyol Süper Lig");
    assert.equal(data.match.league.round, "12. Hafta");
    assert.equal(data.h2h.avg_goals, 1.5);
    assert.equal(matchDataFromContract(detail, { ...extras, context: null }).form.home.xg_for, 1.2);
    assert.equal(data.form.away.goals_against, null);
  });
  it("eksik alanın sahnesi kapanır, nedeni yazılır", () => {
    const entries = evaluatePool(data, BRAND, { now: new Date("2026-11-08T08:00:00Z") });
    const reason = (type: string) => entries.find((entry) => entry.type === type)?.reason;
    assert.ok(reason("Q04_GOALS"));
    assert.ok(reason("Q14_CARDS"));
    assert.ok(reason("Q17_SCORER"));
    assert.equal(reason("Q05_BOTH_SCORE"), null);
  });
  it("tek xG kaynağı: takım kartındaki sezon xG'si varsa soru sahnesi de onu gösterir", () => {
    assert.equal(data.form.home.xg_for, extras.context?.teams.home.xg_for_avg);
    assert.equal(data.form.away.xg_for, extras.context?.teams.away.xg_for_avg);
  });
  it("düello kapsamı veriden: lig rakamı Tüm kulvarlar yazmaz", () => {
    const scoped = matchDataFromContract(detail, { ...extras, players: { ...extras.players, duel_scope: "Trendyol Süper Lig · bu sezon" } });
    const duel = evaluatePool(scoped, BRAND, { now: new Date("2026-11-08T08:00:00Z") }).find((entry) => entry.type === "P01_DUEL");
    assert.equal(duel?.scene?.type === "P01_DUEL" ? duel.scene.data.scope : null, "Trendyol Süper Lig · bu sezon");
  });
});
