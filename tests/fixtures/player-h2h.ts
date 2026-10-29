import type { PlayerSeasonStats } from "@/types/player-h2h";

/**
 * Kurgusal oyuncu sezonları (bkz. CLAUDE.md 5.2) — sayılar uydurma, şekil gerçek (`PlayerSeasonStats`).
 * Havuzun TAMAMI dolu (14+ satır → format kapasitesi sınanır); uzun ad durumu için Mönchengladbach.
 */

const base = {
  season: 2026,
  seasonLabel: "2026/27",
  scope: "LEAGUE" as const,
  penaltyGoals: 1,
  freshness: { source: "api-football" as const, asOfUtc: "2026-11-02T17:00:00Z", missingMatches: 0, addedMatches: 0, note: null },
};

export const H2H_LEFT: PlayerSeasonStats = {
  ...base,
  playerId: 9001,
  fullName: "Kerem Aktürkoğlu",
  shortName: "Aktürkoğlu",
  nameOrigin: "tr",
  teamId: 611,
  teamName: "Fenerbahçe",
  teamOrigin: "tr",
  teamLogo: null,
  position: "FWD",
  league: { id: 203, name: "Süper Lig", label: "SÜPER LİG" },
  competitions: [{ id: 203, name: "Süper Lig" }],
  appearances: 9,
  minutes: 742,
  values: { goals: 7, assists: 4, xg: 5.62, xa: 3.1, shots: 31, shotsOnTarget: 15, bigChancesCreated: 6, keyPasses: 19, passAccuracy: 81.4, dribbles: 17, duelsWonPct: 47.2, interceptions: 5, tackles: 9, rating: 7.52 },
  sources: { goals: "api-football", xg: "sportmonks", xa: "sportmonks", bigChancesCreated: "sportmonks" },
};

export const H2H_RIGHT: PlayerSeasonStats = {
  ...base,
  playerId: 9002,
  fullName: "Alassane Pléa",
  shortName: "Pléa",
  nameOrigin: "intl",
  teamId: 163,
  teamName: "Borussia Mönchengladbach",
  teamOrigin: "intl",
  teamLogo: null,
  position: "FWD",
  league: { id: 78, name: "Bundesliga", label: "BUNDESLIGA" },
  competitions: [{ id: 78, name: "Bundesliga" }],
  appearances: 8,
  minutes: 655,
  penaltyGoals: 2,
  values: { goals: 6, assists: 2, xg: 7.3, xa: 1.8, shots: 27, shotsOnTarget: 11, bigChancesCreated: 3, keyPasses: 12, passAccuracy: 76.9, dribbles: 9, duelsWonPct: 44.1, interceptions: 3, tackles: 6, rating: 7.08 },
  sources: { goals: "api-football" },
};
