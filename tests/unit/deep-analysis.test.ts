import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import { computeSeasonLeagueXg } from "@/lib/services/api-football/form-mappers";
import { apiFootballFixtureDetailRawSchema } from "@/lib/services/api-football/types";
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

describe("computeSeasonLeagueXg — vitrin gerekçesinin xG kaynağı", () => {
  const league = { id: 203, name: "Süper Lig", season: 2026 };
  const [first, second, third] = DEEP_ANALYSIS_FIXTURES;
  const kickoff = new Date((third!.fixture.timestamp + 1) * 1000).toISOString();

  it("yalnızca bu ligin bu sezonki, maçtan önce bitmiş maçları; xG/xGA aynı örneklemden", () => {
    const cup = { ...first!, fixture: { ...first!.fixture, id: 901 }, league: { ...first!.league, id: 206, name: "Türkiye Kupası" } };
    const lastSeason = { ...second!, fixture: { ...second!.fixture, id: 902 }, league: { ...second!.league, season: 2025 } };
    const result = computeSeasonLeagueXg([...DEEP_ANALYSIS_FIXTURES, cup, lastSeason], DEEP_ANALYSIS_TEAM.id, league, kickoff);
    assert.equal(result.matchesSampled, 3);
    assert.equal(Number(result.xgForAvg!.toFixed(2)), 1.7); // (2,40 + 1,10 + 1,60) / 3
    assert.equal(Number(result.xgAgainstAvg!.toFixed(2)), 1.2); // (0,80 + 0,90 + 1,90) / 3
    assert.deepEqual({ leagueId: result.leagueId, season: result.season }, { leagueId: 203, season: 2026 });
  });

  it("başlama saatinden sonraki maç girmez; xG'siz maç örnekleme girmez", () => {
    const beforeThird = new Date(third!.fixture.timestamp * 1000).toISOString();
    assert.equal(computeSeasonLeagueXg(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM.id, league, beforeThird).matchesSampled, 2);
    const noXg = { ...first!, statistics: first!.statistics.map((row) => ({ ...row, statistics: row.statistics.filter((stat) => stat.type !== "expected_goals") })) };
    const result = computeSeasonLeagueXg([noXg, second!, third!], DEEP_ANALYSIS_TEAM.id, league, kickoff);
    assert.equal(result.matchesSampled, 2);
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
