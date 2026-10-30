import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedNumbersBySide,
  buildAnalysisFacts,
  findTeamAbbreviations,
  findUngroundedNumbers,
} from "@/lib/dashboard/expert-analysis-facts";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import { computeSportmonksMetrics, isSameTeam, normalizeTeamName } from "@/lib/services/sportmonks/advanced-stats-mappers";
import type { DeepAnalysisStats, TeamDeepStats } from "@/types/deep-analysis";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";

const home = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
home.form = { ...home.form, teamName: "Galatasaray" };

/** Sayıları ev sahibinden bilerek farklı bir deplasman takımı — izolasyon ancak böyle sınanır. */
const away: TeamDeepStats = {
  ...home,
  form: { ...home.form, teamName: "Kasımpaşa", goalsAgainstAvg: 2.4, xgForAvg: 0.93 },
  possessionAvg: 41.3,
  passAccuracyAvg: 74,
  keyPlayers: [{ ...home.keyPlayers[0]!, name: "Deplasman Golcü", photoUrl: "https://media.api-sports.io/football/players/99.png" }],
};

const stats = {
  fixture: { homeTeam: { name: "Galatasaray" }, awayTeam: { name: "Kasımpaşa" }, competition: { name: "Süper Lig" } },
  home,
  away,
  headToHead: { matches: [{ homeTeamName: "Galatasaray", awayTeamName: "Kasımpaşa", homeGoals: 3, awayGoals: 1 }], homeWins: 1, draws: 0, awayWins: 0 },
} as unknown as DeepAnalysisStats;

const facts = buildAnalysisFacts(stats);
const scopes = allowedNumbersBySide(facts);

describe("ileri metrikler (API-Football)", () => {
  it("şut kalitesi, kilit pas ve PPDA'yı toplamların oranıyla hesaplar", () => {
    assert.equal(home.shotsAvg, null, "fixture'da Total Shots yok → null, sıfır uydurulmaz");
    assert.equal(home.keyPassesAvg?.toFixed(1), "3.0");
    assert.equal(home.ppdaFullPitch, null, "rakip pas/faul yok → null");
  });
});

describe("takım izolasyonlu sayı kümeleri", () => {
  it("ev sahibi, deplasman ve ortak sayılar ayrı tutulur", () => {
    assert.ok(scopes.home.has("56") && !scopes.home.has("41"), "ev sahibi %56, deplasmanın %41'i ev sahibi kümesinde yok");
    assert.ok(scopes.away.has("41") && !scopes.away.has("56"));
    assert.ok(scopes.shared.has("3") && scopes.shared.has("1"), "aralarındaki maç skoru ortak kümede");
  });

  it("sayıyı yalnızca izinli kapsamda arar; rakibe ait olanı ve uydurmayı ayırır", () => {
    assert.deepEqual(findUngroundedNumbers("Maç başı 1.7 xG ve %86 pas isabeti", scopes.home, scopes.away), []);
    assert.deepEqual(findUngroundedNumbers("Maç başı 1,7 xG", scopes.home), [], "Türkçe ondalık virgül de tanınır");
    assert.deepEqual(findUngroundedNumbers("%41 topla oynama", scopes.home, scopes.away), [{ value: "41", foundIn: "opponent" }]);
    assert.deepEqual(findUngroundedNumbers("Maç başı 4.2 büyük şans", scopes.home, scopes.away), [{ value: "4.2", foundIn: "nowhere" }]);
  });
});

describe("kısaltma/lakap denetimi", () => {
  const names = ["Galatasaray", "Kasımpaşa"];
  it("kırpılmış adları ve bilinen kısaltmaları yakalar", () => {
    assert.deepEqual(findTeamAbbreviations("Gala'nın presi", names), ["Gala"]);
    assert.deepEqual(findTeamAbbreviations("GS ile FB arasında", names), ["GS", "FB"]);
    assert.deepEqual(findTeamAbbreviations("Kasım'ın savunması", names), [], "\"Kasım\" ayı gerçek kelime sayılır");
  });
  it("resmi adı ve ekli hâllerini kabul eder", () => {
    assert.deepEqual(findTeamAbbreviations("Galatasaray'ın presi ve Kasımpaşa'nın kontrası", names), []);
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
          lineups: [],
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
