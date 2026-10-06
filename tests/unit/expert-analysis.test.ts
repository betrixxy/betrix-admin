import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import { buildMarketAnalysisDraft } from "@/lib/dashboard/deep-analysis-insights";
import { applyExpertAnalysis } from "@/lib/dashboard/expert-analysis-apply";
import { allowedNumbers, buildAnalysisFacts, findUngroundedNumbers } from "@/lib/dashboard/expert-analysis-facts";
import { computeSportmonksMetrics, isSameTeam, normalizeTeamName } from "@/lib/services/sportmonks/advanced-stats-mappers";
import type { DeepAnalysisStats } from "@/types/deep-analysis";
import { EXPERT_ANALYSIS_OUTPUT } from "../fixtures/anthropic/expert-analysis";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";

const team = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
const stats = {
  fixture: { homeTeam: { name: "Test FK" }, awayTeam: { name: "Test FK" }, competition: { name: "Süper Lig" } },
  home: team,
  away: team,
  headToHead: { matches: [], homeWins: 0, draws: 0, awayWins: 0 },
} as unknown as DeepAnalysisStats;

describe("ileri metrikler (API-Football)", () => {
  it("şut kalitesi, kilit pas ve PPDA'yı toplamların oranıyla hesaplar", () => {
    assert.equal(team.shotsAvg, null, "fixture'da Total Shots yok → null, sıfır uydurulmaz");
    assert.equal(team.keyPassesAvg?.toFixed(1), "3.0");
    assert.equal(team.ppdaFullPitch, null, "rakip pas/faul yok → null");
  });
});

describe("olgu paketi ve sayı denetimi", () => {
  const facts = buildAnalysisFacts(stats);
  const allowed = allowedNumbers(facts);

  it("paketteki sayıları kabul eder, uydurulmuşu yakalar", () => {
    assert.deepEqual(findUngroundedNumbers("Maç başı 1.7 xG ve %86 pas isabeti", allowed), []);
    assert.deepEqual(findUngroundedNumbers("Maç başı 4.2 büyük şans", allowed), ["4.2"]);
    assert.deepEqual(findUngroundedNumbers("Maç başı 1,7 xG", allowed), [], "Türkçe ondalık virgül de tanınır");
  });

  it("modelin çıktısını forma uygular: kırpar, uydurma oyuncuyu atar, uyarı üretir", () => {
    const base = buildMarketAnalysisDraft("api-football-1", stats);
    const { draft, warnings } = applyExpertAnalysis(base, EXPERT_ANALYSIS_OUTPUT, stats, allowed);

    assert.equal(draft.home.strengths.length, 3);
    assert.ok(draft.home.approach.length <= 400 && draft.home.approach.endsWith("…"));
    assert.deepEqual(
      draft.home.keyPlayers.map((p) => p.name),
      ["Forvet Bir", "Orta Saha", "Defans"],
      "uydurma oyuncu atlanır, boşluk kural tabanlı seçimle dolar",
    );
    assert.ok(draft.home.keyPlayers[0]?.photoUrl.includes("/players/11.png"), "fotoğraf gerçek oyuncu verisinden");
    assert.equal(draft.away.keyPlayers[0]?.name, "Defans", "ad büyük/küçük harf farkıyla eşlenir, paketteki yazım kullanılır");
    assert.ok(warnings.some((w) => w.includes("Uydurma Oyuncu")));
    assert.ok(warnings.some((w) => w.includes("güçlü yön 3") && w.includes("4.2")));
    assert.ok(!warnings.some((w) => w.includes("dikkat 1")), "'Son 3 maçta 1 galibiyet' — iki sayı da pakette var, uyarı yok");
    assert.equal(draft.marketPick, "KG Var");
    assert.equal(draft.home.colorHex, base.home.colorHex, "renk/logo/istatistik bloğu korunur");
    assert.deepEqual(draft.home.stats, base.home.stats);
  });
});

describe("Sportmonks", () => {
  it("takım adlarını sağlayıcılar arası eşler", () => {
    assert.equal(normalizeTeamName("Kasımpaşa SK"), "kasimpasa");
    assert.ok(isSameTeam("Kasımpaşa", "Kasimpasa"));
    assert.ok(isSameTeam("İstanbul Başakşehir", "Istanbul Basaksehir FK"));
    assert.ok(!isSameTeam("Galatasaray", "Fenerbahçe"));
  });

  it("büyük şans ve pas isabetini rakibe göre ayırır", () => {
    const stat = (participant_id: number, name: string, value: number) => ({ participant_id, type: { developer_name: name }, data: { value } });
    const metrics = computeSportmonksMetrics(
      [
        {
          id: 1,
          starting_at: "2026-09-19 17:00:00",
          participants: [{ id: 34, name: "Galatasaray" }, { id: 688, name: "Trabzonspor" }],
          statistics: [
            stat(34, "BIG_CHANCES_CREATED", 1),
            stat(688, "BIG_CHANCES_CREATED", 6),
            stat(34, "LONG_PASSES", 50),
            stat(34, "SUCCESSFUL_LONG_PASSES", 24),
          ],
        },
      ],
      34,
    );
    assert.equal(metrics.bigChancesCreatedAvg, 1);
    assert.equal(metrics.bigChancesConcededAvg, 6);
    assert.equal(metrics.longPassAccuracyPct, 48);
    assert.equal(metrics.crossAccuracyPct, null);
  });
});
