import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";

/** Kurgusal API-Football `/fixtures` satırları — "Haftanın Maçları" eşleyici testleri için (şema birebir). */
export function rawFixture(id: number, overrides: { date: string; short: string; elapsed?: number | null; round?: string; home?: [number, string, number | null]; away?: [number, string, number | null] }): ApiFootballFixtureRaw {
  const [homeId, homeName, homeGoals] = overrides.home ?? [10, "Kurgu SK", null];
  const [awayId, awayName, awayGoals] = overrides.away ?? [20, "Rakip FK", null];
  return {
    fixture: { id, date: overrides.date, timestamp: Date.parse(overrides.date) / 1000, status: { long: "", short: overrides.short, elapsed: overrides.elapsed ?? null } },
    league: { id: 203, name: "Süper Lig", country: "Turkey", season: 2026, round: overrides.round ?? "Regular Season - 7", logo: "https://media.api-sports.io/football/leagues/203.png" },
    teams: {
      home: { id: homeId, name: homeName, logo: `https://media.api-sports.io/football/teams/${homeId}.png`, winner: null },
      away: { id: awayId, name: awayName, logo: `https://media.api-sports.io/football/teams/${awayId}.png`, winner: null },
    },
    goals: { home: homeGoals, away: awayGoals },
  };
}

/** UTC 17:00 → TSİ 20.00 (aynı gün); UTC 21:30 → TSİ 00.30 (ertesi gün). */
export const RAW_FINISHED = rawFixture(1, { date: "2026-10-09T17:00:00+00:00", short: "FT", home: [10, "Kurgu SK", 3], away: [20, "Rakip FK", 1] });
export const RAW_LATE = rawFixture(2, { date: "2026-10-10T21:30:00+00:00", short: "NS" });
export const RAW_LIVE = rawFixture(3, { date: "2026-10-11T13:00:00+00:00", short: "2H", elapsed: 62, home: [30, "Canlı SK", 0], away: [40, "Dakika FK", 0] });
export const RAW_TBD = rawFixture(4, { date: "2026-10-12T00:00:00+00:00", short: "TBD" });
export const RAW_POSTPONED = rawFixture(5, { date: "2026-10-12T17:00:00+00:00", short: "PST" });
