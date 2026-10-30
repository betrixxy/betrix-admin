import type { ScenarioId, ScenarioOutcome } from "@/types/prediction";
import type { ScorecardEntry, ScorecardMatch, ScorecardRecord } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi test verisi — KURGUSAL kayıtlar (prod'da kayıt yok). Maç künyesi gerçek takımlarla ama skor
 * ve tahminler sentetik. Dönem kayıtları Ekim 2026'ya yayılır; model sürümü karışık (null = v1, "v2-season-xg").
 */

export const KONYA_GS: ScorecardMatch = {
  fixtureId: "api-football-1394702",
  kickoffUtc: "2026-10-30T17:00:00.000Z",
  competition: { id: 203, name: "Trendyol Süper Lig" },
  roundLabel: "10. Hafta",
  home: { id: 607, name: "Konyaspor", logoUrl: null, origin: { name: "tr", people: "tr" } },
  away: { id: 645, name: "Galatasaray", logoUrl: null, origin: { name: "tr", people: "tr" } },
  score: { statusShort: "FT", fulltime: { home: 1, away: 2 }, halftime: { home: 1, away: 1 } },
};

export const record = (id: string, outcome: ScenarioOutcome, probability: number, extra: Partial<ScorecardRecord> = {}): ScorecardRecord => ({
  id,
  fixtureId: KONYA_GS.fixtureId,
  scenarioId: outcome.scenario as ScenarioId,
  outcome,
  probability,
  modelVersion: "v2-season-xg",
  recordedAt: "2026-10-29T10:00:00.000Z",
  ...extra,
});

/** Vitrin onayının yazdığı gibi 2 açık kutu: kazanma (Galatasaray, tuttu) + ilk yarı (Galatasaray, tutmadı: İY 1–1). */
export const KONYA_GS_RECORDS: ScorecardRecord[] = [record("rec-a", { scenario: "RESULT_1X2", pick: "AWAY" }, 0.52), record("rec-b", { scenario: "HT_RESULT", pick: "AWAY" }, 0.41)];

/** Altı senaryonun hepsi (A'nın en kalabalık hâli). */
export const KONYA_GS_ALL_SIX: ScorecardRecord[] = [
  ...KONYA_GS_RECORDS,
  record("rec-c", { scenario: "BTTS", pick: "YES" }, 0.58),
  record("rec-d", { scenario: "GOALS_3PLUS", pick: "YES" }, 0.55),
  record("rec-e", { scenario: "GOALS_4PLUS", pick: "NO" }, 0.71),
  record("rec-f", { scenario: "COMBO", team: "AWAY", pick: "NO" }, 0.68),
];

const OUTCOMES: ScenarioOutcome[] = [
  { scenario: "RESULT_1X2", pick: "HOME" },
  { scenario: "BTTS", pick: "YES" },
  { scenario: "GOALS_3PLUS", pick: "NO" },
  { scenario: "HT_RESULT", pick: "DRAW" },
  { scenario: "GOALS_4PLUS", pick: "NO" },
  { scenario: "COMBO", team: "HOME", pick: "NO" },
];

/**
 * Ekim 2026'da `count` kayıt: her maç 2 kayıt, maçlar 2 gün arayla; `pattern` H/M dizisi tekrarlanır. İlk
 * yarısı v1 (null), kalanı v2.
 */
export function octoberEntries(count: number, pattern = "HHMHMHHM"): ScorecardEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const day = String(1 + Math.floor(index / 2) * 2).padStart(2, "0");
    const outcome = OUTCOMES[index % OUTCOMES.length] as ScenarioOutcome;
    return {
      record: { id: `oct-${String(index).padStart(2, "0")}`, fixtureId: `api-football-${9000 + Math.floor(index / 2)}`, scenarioId: outcome.scenario as ScenarioId, outcome, probability: 0.55, modelVersion: index < count / 2 ? null : "v2-season-xg", recordedAt: `2026-10-${day}T08:00:00.000Z` },
      kickoffUtc: `2026-10-${day}T17:00:00.000Z`,
      status: pattern[index % pattern.length] === "H" ? "HIT" : "MISS",
    };
  });
}
