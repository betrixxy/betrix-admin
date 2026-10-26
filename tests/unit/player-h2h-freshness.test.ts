import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildH2HCard } from "@/lib/dashboard/player-h2h-card";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { comparisonWarnings, freshnessLabel } from "@/lib/player-h2h/checks";
import { fixtureEntry, missingAppearances, playerAppearances } from "@/lib/services/api-football/player-recency-mappers";
import { aggregateSeason } from "@/lib/services/api-football/player-season-mappers";
import type { ApiFootballFixturePlayers, ApiFootballPlayerSeasonEntry } from "@/lib/services/api-football/player-season-types";
import type { PlayerSeasonStats } from "@/types/player-h2h";
import { H2H_LEFT, H2H_RIGHT } from "../fixtures/player-h2h";

/**
 * Güncellik kararı (2026-10-27): sezon toplamı API-Football; toplama girmemiş bitmiş maçlar aynı sağlayıcının
 * maç bazlı istatistiğinden eklenir; yapılamazsa o oyuncu için bütün satırlar Sportmonks (karışım yok).
 */

const TEAM = { id: 998, name: "Trabzonspor" };
const PLAYER = 306;

/** Kurgusal maç: oyuncu `minutes` oynadı (0 = süre almadı), 1 gol, 20 pasın 15'i isabetli. */
function fixture(id: number, day: number, minutes: number): ApiFootballFixturePlayers {
  return {
    fixture: { id, date: `2026-10-${String(day).padStart(2, "0")}T16:00:00+00:00`, timestamp: Date.UTC(2026, 9, day, 16) / 1000, status: { short: "FT" } },
    league: { id: 203, name: "Süper Lig", season: 2026 },
    players: [
      {
        team: { id: TEAM.id },
        players: [{ player: { id: PLAYER }, statistics: [{ games: { minutes, rating: "7.0" }, shots: { total: 2, on: 1 }, goals: { total: 1, assists: 0, saves: 0 }, passes: { total: 20, key: 2, accuracy: "15" }, tackles: { total: 1, interceptions: 0 }, duels: { total: 10, won: 4 }, dribbles: { attempts: 2, success: 1 }, penalty: { scored: 0 } }] }],
      },
    ],
  };
}

// 5 maç: 3. maçta süre almadı → 4 süre alınan maç.
const FIXTURES = [fixture(1, 5, 90), fixture(2, 12, 80), fixture(3, 19, 0), fixture(4, 26, 86), fixture(5, 2, 90)].map((f, i) => (i === 4 ? { ...f, fixture: { ...f.fixture, timestamp: Date.UTC(2026, 10, 2, 16) / 1000 } } : f));

describe("toplama girmemiş maçlar (maç sayısı × süre alınan maç listesi)", () => {
  const appearances = playerAppearances(FIXTURES, PLAYER, TEAM);

  it("süre alınan maçlar kronolojik; süre almadığı maç sayılmaz", () => {
    assert.deepEqual(appearances.map((a) => a.fixtureId), [1, 2, 4, 5]);
  });

  it("eksik 0 maç: toplam güncel", () => {
    const result = missingAppearances(4, appearances);
    assert.ok(result.ok);
    assert.deepEqual(result.data, []);
  });

  it("eksik 1 maç: en son maç eklenir", () => {
    const result = missingAppearances(3, appearances);
    assert.ok(result.ok);
    assert.deepEqual(result.data.map((a) => a.fixtureId), [5]);
  });

  it("eksik 2 maç: son iki maç eklenir (süre almadığı maç atlanır)", () => {
    const result = missingAppearances(2, appearances);
    assert.ok(result.ok);
    assert.deepEqual(result.data.map((a) => a.fixtureId), [4, 5]);
  });

  it("maç listesi toplamdan kısaysa eşleştirme yok → Sportmonks yolu", () => {
    const result = missingAppearances(5, appearances);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "FIXTURE_DATA_MISSING");
  });

  it("maç kaydı: pas isabeti SAYIDAN yüzdeye (15/20 → %75), tek maç", () => {
    const entry = fixtureEntry(FIXTURES[0]!.players[0]!.players[0]!.statistics[0]!, FIXTURES[0]!, TEAM);
    assert.equal(entry.passes?.accuracy, 75);
    assert.equal(entry.games.appearences, 1);
  });

  it("toplam + eksik maç: sayılar toplanır, yüzdeler ağırlıklı, dakika ve maç güncellenir", () => {
    const season: ApiFootballPlayerSeasonEntry = {
      team: TEAM,
      league: { id: 203, name: "Süper Lig", season: 2026 },
      games: { appearences: 3, minutes: 256, position: "Attacker", rating: "8" },
      shots: { total: 6, on: 3 },
      goals: { total: 3, assists: 1, saves: null },
      passes: { total: 60, key: 6, accuracy: 80 },
      tackles: { total: 3, interceptions: 0 },
      duels: { total: 30, won: 12 },
      dribbles: { attempts: 6, success: 3 },
      penalty: { scored: 1 },
    };
    const missing = missingAppearances(3, appearances);
    assert.ok(missing.ok);
    const total = aggregateSeason([season, ...missing.data.map((a) => a.entry)], () => true);
    assert.equal(total.appearances, 4);
    assert.equal(total.minutes, 346);
    assert.equal(total.values.goals, 4);
    assert.equal(total.values.passAccuracy, (80 * 60 + 75 * 20) / 80);
    assert.equal(total.penaltyGoals, 1);
  });
});

describe("künye ve uyarılar: güncellik", () => {
  const withAsOf = (asOfUtc: string | null, source: "api-football" | "sportmonks" = "api-football"): PlayerSeasonStats => ({ ...H2H_LEFT, league: H2H_LEFT.league, freshness: { source, asOfUtc, addedMatches: 1, note: source === "sportmonks" ? "maç verisi eksik" : null } });

  it("aynı tarih: '26.10 İTİBARIYLA' (İstanbul saati), uyarı yok", () => {
    const a = withAsOf("2026-10-26T16:00:00Z");
    const b = withAsOf("2026-10-26T18:30:00Z");
    assert.equal(freshnessLabel(a, b), "26.10 İTİBARIYLA");
    assert.ok(!comparisonWarnings(a, b).some((w) => w.startsWith("Güncellik")));
  });

  it("farklı tarih: iki tarih + stüdyo uyarısı; bilinmeyen tarih uyarısı", () => {
    const a = withAsOf("2026-10-26T16:00:00Z");
    const b = withAsOf("2026-10-25T16:00:00Z");
    assert.equal(freshnessLabel(a, b), "26.10 / 25.10 İTİBARIYLA");
    assert.ok(comparisonWarnings(a, b).includes("Güncellik farklı: Aktürkoğlu 26.10, Aktürkoğlu 25.10 itibarıyla"));
    assert.equal(freshnessLabel(a, withAsOf(null)), "");
    assert.ok(comparisonWarnings(a, withAsOf(null)).some((w) => w.startsWith("Güncellik tarihi bilinmiyor")));
  });

  it("Sportmonks'a geçen oyuncu uyarıda; dipnot oyuncu başına tek kaynak; künyede tarih", async () => {
    const left = withAsOf("2026-10-26T16:00:00Z");
    const right: PlayerSeasonStats = { ...H2H_RIGHT, freshness: { source: "sportmonks", asOfUtc: "2026-10-26T18:00:00Z", addedMatches: 0, note: "maç verisi eksik" } };
    assert.ok(comparisonWarnings(left, right).some((w) => w.startsWith("Pléa: bütün satırlar Sportmonks'tan")));
    const built = buildH2HCard({ left, right, mode: "TOTAL", match: null, images: { leftLogo: null, rightLogo: null, leftFace: null, rightFace: null, brandLogo: "" }, frame: MATCH_DAY_FRAMES.IG_PORTRAIT });
    assert.ok(built.ok);
    assert.equal(built.data.card.scopeLabel, "2026/27 · SÜPER LİG / BUNDESLIGA · 26.10 İTİBARIYLA");
    assert.ok(built.data.card.footnotes.includes("Veri: Aktürkoğlu API-Football · Pléa Sportmonks."));
  });
});
