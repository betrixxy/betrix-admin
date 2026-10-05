import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMarketAnalysisDraft, suggestMarkets } from "@/lib/dashboard/deep-analysis-insights";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import { apiFootballFixtureDetailRawSchema } from "@/lib/services/api-football/types";
import type { DeepAnalysisStats } from "@/types/deep-analysis";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";

describe("computeTeamDeepStats", () => {
  const stats = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);

  it("maç istatistiklerinin ortalamasını alır", () => {
    assert.equal(stats.statMatchesSampled, 3);
    assert.equal(stats.possessionAvg?.toFixed(1), "55.7");
    assert.equal(stats.passAccuracyAvg?.toFixed(1), "86.0");
    assert.equal(stats.shotsOnTargetAvg?.toFixed(2), "4.67");
  });

  it("top kazanmayı (müdahale + top kesme) ve ikili mücadeleyi oyunculardan toplar", () => {
    // Maç 1: 1+0+3+2+4+3 = 13 · Maç 2: 0+0+2+2+5+1 = 10 · Maç 3: 0+1+2+1+0+0 = 4
    assert.equal(stats.ballWinsAvg?.toFixed(1), "9.0");
    assert.equal(stats.duelsWonPct?.toFixed(0), "60");
  });

  it("KG / 2.5 üst / gol yememe / gol atamama sayılarını hesaplar", () => {
    assert.deepEqual(
      { btts: stats.bttsCount, over: stats.over25Count, clean: stats.cleanSheets, failed: stats.failedToScore },
      { btts: 2, over: 2, clean: 1, failed: 1 },
    );
  });

  it("en sık dizilişi ve puana göre anahtar oyuncuları bulur", () => {
    assert.equal(stats.formation, "4-2-3-1");
    assert.deepEqual(
      stats.keyPlayers.map((p) => [p.name, p.appearances, p.goals, p.avgRating?.toFixed(2)]),
      [
        ["Forvet Bir", 3, 3, "7.23"],
        ["Orta Saha", 3, 1, "7.17"],
        ["Defans", 2, 0, "7.15"],
      ],
    );
    // Puanı olmayan / tek maçlık yedek anahtar oyuncu olmaz.
    assert.ok(!stats.keyPlayers.some((p) => p.name === "Yedek"));
  });

  it("istatistik/oyuncu bloğu olmayan maçlarda null döner, sıfır uydurmaz", () => {
    const bare = DEEP_ANALYSIS_FIXTURES.map((raw) => ({ ...raw, statistics: [], players: [], lineups: [] }));
    const empty = computeTeamDeepStats(bare, DEEP_ANALYSIS_TEAM);
    assert.equal(empty.possessionAvg, null);
    assert.equal(empty.ballWinsAvg, null);
    assert.equal(empty.duelsWonPct, null);
    assert.equal(empty.formation, null);
    assert.deepEqual(empty.keyPlayers, []);
  });
});

describe("şema toleransı", () => {
  it("bozuk oyuncu/diziliş bloğu tüm fikstürü düşürmez", () => {
    const [first] = DEEP_ANALYSIS_FIXTURES;
    const parsed = apiFootballFixtureDetailRawSchema.safeParse({ ...first, players: [{ broken: true }], lineups: "x" });
    assert.ok(parsed.success);
    assert.deepEqual(parsed.success && [parsed.data.players, parsed.data.lineups], [[], []]);
  });
});

describe("buildMarketAnalysisDraft / suggestMarkets", () => {
  const team = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
  const stats = { home: team, away: team } as unknown as DeepAnalysisStats;

  it("eşiği geçen maddeleri gerçek sayılarla yazar, kalanı boş bırakır", () => {
    const draft = buildMarketAnalysisDraft("api-football-1", stats);
    assert.equal(draft.home.strengths.length, 3);
    assert.ok(draft.home.strengths.includes("%86 pas isabeti"));
    assert.ok(draft.home.strengths.includes("Maç başı 1.7 xG — net pozisyon üretiyor"));
    assert.deepEqual(
      draft.home.stats.map((s) => s.value),
      ["5.1", "%56", "%86", "9.0"],
    );
    assert.equal(draft.home.keyPlayers[0]?.role, "Forvet · 3 gol · 7.2 puan");
    assert.equal(draft.home.quote, "");
  });

  it("market önerisi gerekçesini sayıyla verir", () => {
    const picks = suggestMarkets(stats);
    // Beklenen toplam gol: (1.33+1.0)/2*2 = 2.3 → üst/alt eşiği yok; KG 4/6 ≈ %67 → KG Var.
    assert.deepEqual(picks.map((p) => p.pick), ["KG Var"]);
    assert.equal(picks[0]?.reason, "İki takımın son 6 maçında 4 kez karşılıklı gol");
  });
});
