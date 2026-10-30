import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { toScorecardMatch, type ApiFootballScoreRaw } from "@/lib/services/api-football/fixture-score-mappers";
import { EVALUATOR_VERSION, outcomeRowFor, settleOutcome } from "@/lib/prediction/settle";
import type { ScenarioOutcome } from "@/types/prediction";
import type { FixtureScore, Goals } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi değerlendiricisi (`lib/prediction/settle.ts`): her senaryo tuttu/tutmadı, ilk yarı
 * senaryosu ilk yarı skoruyla, uzatma/penaltıda normal süre skoru, erteleme/iptal → sonuçlanmadı, bitmemiş
 * maç değerlendirilemez; sonuç tablosu yalnızca eklenir (düzeltme = yeni revizyon).
 */

const ft = (fulltime: Goals, halftime: Goals, statusShort = "FT"): FixtureScore => ({ statusShort, fulltime, halftime });
const status = (outcome: ScenarioOutcome, score: FixtureScore) => {
  const settled = settleOutcome(outcome, score);
  return settled.kind === "SETTLED" ? settled.status : settled.kind;
};

describe("değerlendirici — senaryo × skor", () => {
  const away12 = ft({ home: 1, away: 2 }, { home: 0, away: 0 });
  const draw00 = ft({ home: 0, away: 0 }, { home: 0, away: 0 });
  const home31 = ft({ home: 3, away: 1 }, { home: 2, away: 0 });

  it("RESULT_1X2: ev / beraberlik / deplasman", () => {
    assert.equal(status({ scenario: "RESULT_1X2", pick: "AWAY" }, away12), "HIT");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "HOME" }, away12), "MISS");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "DRAW" }, draw00), "HIT");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "DRAW" }, home31), "MISS");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "HOME" }, home31), "HIT");
  });

  it("HT_RESULT ilk yarı skorunu okur, maç skorunu değil", () => {
    assert.equal(status({ scenario: "HT_RESULT", pick: "DRAW" }, away12), "HIT", "ilk yarı 0–0, maç 1–2");
    assert.equal(status({ scenario: "HT_RESULT", pick: "AWAY" }, away12), "MISS");
    assert.equal(status({ scenario: "HT_RESULT", pick: "HOME" }, home31), "HIT");
    const settled = settleOutcome({ scenario: "HT_RESULT", pick: "DRAW" }, away12);
    assert.ok(settled.kind === "SETTLED" && settled.basis === "HALFTIME" && settled.score.home === 0 && settled.score.away === 0);
    assert.equal(status({ scenario: "HT_RESULT", pick: "DRAW" }, { statusShort: "FT", fulltime: { home: 1, away: 2 }, halftime: null }), "PENDING", "ilk yarı skoru yoksa değerlendirilmez");
  });

  it("BTTS evet / hayır", () => {
    assert.equal(status({ scenario: "BTTS", pick: "YES" }, away12), "HIT");
    assert.equal(status({ scenario: "BTTS", pick: "NO" }, away12), "MISS");
    assert.equal(status({ scenario: "BTTS", pick: "YES" }, draw00), "MISS");
    assert.equal(status({ scenario: "BTTS", pick: "NO" }, ft({ home: 2, away: 0 }, { home: 1, away: 0 })), "HIT");
  });

  it("GOALS_3PLUS / GOALS_4PLUS sınırları (3 ve 4 gol dahil)", () => {
    assert.equal(status({ scenario: "GOALS_3PLUS", pick: "YES" }, away12), "HIT", "tam 3 gol");
    assert.equal(status({ scenario: "GOALS_3PLUS", pick: "NO" }, away12), "MISS");
    assert.equal(status({ scenario: "GOALS_3PLUS", pick: "NO" }, ft({ home: 1, away: 1 }, { home: 0, away: 0 })), "HIT");
    assert.equal(status({ scenario: "GOALS_4PLUS", pick: "YES" }, away12), "MISS");
    assert.equal(status({ scenario: "GOALS_4PLUS", pick: "YES" }, home31), "HIT", "tam 4 gol");
    assert.equal(status({ scenario: "GOALS_4PLUS", pick: "NO" }, away12), "HIT");
  });

  it("COMBO: seçilen takım kazanır VE 3+ gol (ikisi birden)", () => {
    assert.equal(status({ scenario: "COMBO", team: "AWAY", pick: "YES" }, away12), "HIT");
    assert.equal(status({ scenario: "COMBO", team: "HOME", pick: "YES" }, away12), "MISS", "kazanan yanlış");
    assert.equal(status({ scenario: "COMBO", team: "HOME", pick: "YES" }, ft({ home: 2, away: 0 }, { home: 1, away: 0 })), "MISS", "gol az");
    assert.equal(status({ scenario: "COMBO", team: "HOME", pick: "NO" }, ft({ home: 2, away: 0 }, { home: 1, away: 0 })), "HIT");
    assert.equal(status({ scenario: "COMBO", team: "HOME", pick: "YES" }, home31), "HIT");
  });

  it("uzatma (AET) ve penaltı (PEN): normal süre skoru — uzatma golü sayılmaz", () => {
    const aet = ft({ home: 1, away: 1 }, { home: 0, away: 1 }, "AET");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "DRAW" }, aet), "HIT");
    assert.equal(status({ scenario: "GOALS_3PLUS", pick: "YES" }, aet), "MISS");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "DRAW" }, ft({ home: 2, away: 2 }, { home: 1, away: 1 }, "PEN")), "HIT");
    assert.equal(status({ scenario: "RESULT_1X2", pick: "DRAW" }, { statusShort: "AET", fulltime: null, halftime: { home: 0, away: 0 } }), "PENDING", "normal süre skoru yoksa yedek yok");
  });
});

describe("değerlendirici — durumlar", () => {
  const outcome: ScenarioOutcome = { scenario: "RESULT_1X2", pick: "HOME" };
  it("erteleme / iptal / yarıda kalma / askı / hükmen / çıkmama → sonuçlanmadı (VOID)", () => {
    for (const code of ["PST", "CANC", "ABD", "SUSP", "AWD", "WO", "pst"]) {
      const settled = settleOutcome(outcome, { statusShort: code, fulltime: { home: 3, away: 0 }, halftime: { home: 1, away: 0 } });
      assert.equal(settled.kind, "VOID", code);
      assert.ok(settled.kind === "VOID" && /sonuçlanmadı/u.test(settled.reason));
    }
  });

  it("bitmemiş maç değerlendirilemez (PENDING), bilinmeyen kod da", () => {
    for (const code of ["NS", "TBD", "1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE", "XYZ", ""]) {
      assert.equal(settleOutcome(outcome, { statusShort: code, fulltime: { home: 1, away: 0 }, halftime: { home: 1, away: 0 } }).kind, "PENDING", code || "boş");
    }
  });
});

describe("sonuç tablosu — yalnızca ekleme, düzeltme yeni revizyon", () => {
  const record = { id: "rec-1", fixtureId: "api-football-1", outcome: { scenario: "RESULT_1X2", pick: "AWAY" } as ScenarioOutcome };
  const fixture = { statusShort: "FT", fulltime: { home: 1, away: 2 }, halftime: { home: 0, away: 1 }, kickoffUtc: "2026-10-30T17:00:00Z" };

  it("ilk değerlendirme revizyon 1; aynı sonuç tekrar yazılmaz; bitmemiş maç yazılmaz", () => {
    const first = outcomeRowFor(record, fixture, null);
    assert.ok(first);
    assert.deepEqual({ ...first, kickoffAt: first.kickoffAt.toISOString() }, {
      predictionRecordId: "rec-1", fixtureId: "api-football-1", revision: 1, status: "HIT", fixtureStatus: "FT", kickoffAt: "2026-10-30T17:00:00.000Z",
      homeGoals: 1, awayGoals: 2, htHomeGoals: 0, htAwayGoals: 1, evaluatorVersion: EVALUATOR_VERSION, note: null,
    });
    assert.equal(outcomeRowFor(record, fixture, first), null);
    assert.equal(outcomeRowFor(record, { ...fixture, statusShort: "2H" }, null), null);
  });

  it("skor düzeltmesi → revizyon 2 + not; erteleme → VOID satırı, skor yok", () => {
    const first = outcomeRowFor(record, fixture, null);
    assert.ok(first);
    const corrected = outcomeRowFor(record, { ...fixture, fulltime: { home: 2, away: 2 } }, first);
    assert.ok(corrected);
    assert.equal(corrected.revision, 2);
    assert.equal(corrected.status, "MISS");
    assert.match(corrected.note ?? "", /Düzeltme \(rev\. 1 → 2\): HIT 1–2 → MISS 2–2/u);
    const voided = outcomeRowFor(record, { ...fixture, statusShort: "PST" }, null);
    assert.ok(voided && voided.status === "VOID" && voided.homeGoals === null && /ertelendi/u.test(voided.note ?? ""));
  });

  it("migration: tablo ayrı, değişmezlik trigger'ı; PredictionRecord'a yazan/değiştiren SQL yok", () => {
    const sql = readFileSync("prisma/migrations/20261030200000_prediction_outcome/migration.sql", "utf8");
    assert.match(sql, /CREATE TABLE "PredictionOutcome"/u);
    assert.match(sql, /BEFORE UPDATE OR DELETE ON "PredictionOutcome"/u);
    assert.match(sql, /BEFORE TRUNCATE ON "PredictionOutcome"/u);
    assert.doesNotMatch(sql, /(ALTER TABLE|UPDATE|INSERT INTO|DELETE FROM|DROP)\s+"PredictionRecord"/u);
    assert.doesNotMatch(sql.replace(/^--.*$/gmu, ""), /ON "PredictionRecord"/u);
  });
});

describe("API-Football skor eşlemesi", () => {
  const raw = (status: string, score: Partial<Record<"halftime" | "fulltime" | "extratime" | "penalty", { home: number | null; away: number | null }>>, goals = { home: 2, away: 1 }): ApiFootballScoreRaw =>
    ({
      fixture: { id: 1, date: "2026-10-30T17:00:00+00:00", timestamp: 0, status: { long: "", short: status, elapsed: 90 } },
      league: { id: 203, name: "Süper Lig", country: "Turkey", season: 2026, round: "Regular Season - 10" },
      teams: { home: { id: 607, name: "Konyaspor", logo: "", winner: null }, away: { id: 645, name: "Galatasaray", logo: "", winner: null } },
      goals,
      score,
    }) as ApiFootballScoreRaw;

  it("normal süre `score.fulltime`; AET'de `goals` (uzatma dahil) yedek değil; FT'de `goals` yedek", () => {
    const aet = toScorecardMatch(raw("AET", { fulltime: { home: 1, away: 1 }, halftime: { home: 0, away: 1 }, extratime: { home: 1, away: 0 } }));
    assert.deepEqual(aet.score, { statusShort: "AET", fulltime: { home: 1, away: 1 }, halftime: { home: 0, away: 1 } });
    assert.equal(toScorecardMatch(raw("AET", {})).score.fulltime, null);
    assert.deepEqual(toScorecardMatch(raw("FT", {})).score.fulltime, { home: 2, away: 1 });
    const match = toScorecardMatch(raw("FT", {}));
    assert.equal(match.fixtureId, "api-football-1");
    assert.equal(match.competition.name, "Trendyol Süper Lig");
    assert.equal(match.roundLabel, "10. Hafta");
  });
});
