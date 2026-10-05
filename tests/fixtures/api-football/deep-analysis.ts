import type { ApiFootballFixtureDetailRaw } from "@/lib/services/api-football/types";

/**
 * Kurgusal `/fixtures?ids=` ayrıntılı fikstürleri (bkz. CLAUDE.md 5.2) — şema gerçek yanıtla
 * birebir, veriler uydurma. Takım 1 ("Test FK") eskiden yeniye 3 maç oynar: 3-1 G, 0-0 B, 1-2 M.
 */

const TEAM = { id: 1, name: "Test FK", logo: "https://media.api-sports.io/football/teams/1.png", winner: null };
const opponent = (id: number) => ({ id, name: `Rakip ${id}`, logo: `https://media.api-sports.io/football/teams/${id}.png`, winner: null });

function stats(teamId: number, possession: string, passes: string, onTarget: number, xg: string) {
  return {
    team: { id: teamId },
    statistics: [
      { type: "Shots on Goal", value: onTarget },
      { type: "Ball Possession", value: possession },
      { type: "Passes %", value: passes },
      { type: "expected_goals", value: xg },
    ],
  };
}

function player(id: number, name: string, position: string, minutes: number, rating: string | null, goals: number, assists: number, tackles: number, interceptions: number) {
  return {
    player: { id, name, photo: `https://media.api-sports.io/football/players/${id}.png` },
    statistics: [
      {
        games: { minutes, position, rating },
        goals: { total: goals, assists },
        passes: { key: 1 },
        tackles: { total: tackles, interceptions },
        duels: { total: 10, won: 6 },
      },
    ],
  };
}

function match(
  fixtureId: number,
  timestamp: number,
  opponentId: number,
  goals: { home: number; away: number },
  teamStats: ReturnType<typeof stats>,
  oppStats: ReturnType<typeof stats>,
  formation: string,
  players: ReturnType<typeof player>[],
): ApiFootballFixtureDetailRaw {
  return {
    fixture: { id: fixtureId, date: new Date(timestamp * 1000).toISOString(), timestamp, status: { long: "Match Finished", short: "FT", elapsed: 90 } },
    league: { id: 203, name: "Süper Lig", country: "Turkey", season: 2026, round: "Regular Season - 1" },
    teams: { home: TEAM, away: opponent(opponentId) },
    goals,
    statistics: [teamStats, oppStats],
    players: [{ team: { id: 1 }, players }],
    lineups: [{ team: { id: 1 }, formation }],
  };
}

export const DEEP_ANALYSIS_TEAM = { id: 1, name: "Test FK", logoUrl: TEAM.logo };

export const DEEP_ANALYSIS_FIXTURES: ApiFootballFixtureDetailRaw[] = [
  match(101, 1_790_000_000, 2, { home: 3, away: 1 }, stats(1, "60%", "88%", 7, "2.40"), stats(2, "40%", "75%", 2, "0.80"), "4-2-3-1", [
    player(11, "Forvet Bir", "F", 90, "8.1", 2, 0, 1, 0),
    player(12, "Orta Saha", "M", 90, "7.4", 1, 1, 3, 2),
    player(13, "Defans", "D", 90, "7.0", 0, 0, 4, 3),
  ]),
  match(102, 1_790_600_000, 3, { home: 0, away: 0 }, stats(1, "55%", "86%", 3, "1.10"), stats(3, "45%", "80%", 2, "0.90"), "4-2-3-1", [
    player(11, "Forvet Bir", "F", 90, "6.6", 0, 0, 0, 0),
    player(12, "Orta Saha", "M", 85, "7.2", 0, 0, 2, 2),
    player(13, "Defans", "D", 90, "7.3", 0, 0, 5, 1),
  ]),
  match(103, 1_791_200_000, 4, { home: 1, away: 2 }, stats(1, "52%", "84%", 4, "1.60"), stats(4, "48%", "79%", 5, "1.90"), "4-3-3", [
    player(11, "Forvet Bir", "F", 90, "7.0", 1, 0, 0, 1),
    player(12, "Orta Saha", "M", 90, "6.9", 0, 1, 2, 1),
    player(14, "Yedek", "F", 10, null, 0, 0, 0, 0),
  ]),
];
