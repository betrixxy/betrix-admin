import type { ReelLastLineup } from "../../../src/lib/reels/lineup-rule";
import type { MatchContext, TeamContext } from "../story/match-context";

/** KURGUSAL futbol okuması: takımlar ve bütün sayılar uydurmadır. Şema `story/match-context.ts`. */

/** Kurgusal kadro: uzun ad sütuna sığıyor mu diye bir tane uzun soyad var. */
const xi = (fixture: number, formation: string, base: number, names: readonly [number, string, string, number][]): ReelLastLineup => ({
  fixture_id: fixture, date: "2026-11-01T17:00:00Z", formation,
  players: names.map(([id, name, short, number]) => ({ id: id || base, name, short_name: short, number })),
});
export const DERBY_HOME_XI = xi(900101, "4-2-3-1", 0, [[90100, "Kurgu Kaleci", "K. Kaleci", 1], [90101, "Örnek Bek", "Ö. Bek", 2], [90102, "Kurgu Stoper", "K. Stoper", 4], [90103, "Yıldırımoğlu", "T. Yıldırımoğlu", 5], [90104, "Örnek Sol", "Ö. Sol", 3], [90105, "Kurgu Orta", "K. Orta", 6], [90106, "Örnek Pasör", "Ö. Pasör", 8], [90012, "Yedek Kanat", "Y. Kanat", 7], [90107, "Kurgu On", "K. On", 10], [90108, "Örnek Kanat", "Ö. Kanat", 11], [90011, "Kurgu Forvet", "K. Forvet", 9]]);
export const DERBY_AWAY_XI = xi(900102, "4-3-3", 0, [[90200, "Örnek Kaleci", "Ö. Kaleci", 12], [90201, "Kurgu Bek", "K. Bek", 22], [90202, "Örnek Stoper", "Ö. Stoper", 15], [90203, "Kurgu Libero", "K. Libero", 5], [90204, "Kurgu Sol", "K. Sol", 33], [90205, "Örnek Orta", "Ö. Orta", 6], [90022, "Yedek Orta", "Y. Orta", 8], [90206, "Kurgu Pasör", "K. Pasör", 10], [90207, "Kurgu Kanat", "K. Kanat", 7], [90021, "Örnek Golcü", "Ö. Golcü", 9], [90208, "Örnek Açık", "Ö. Açık", 77]]);

const team = (over: Partial<TeamContext>): TeamContext => ({
  form: "WDWLWDW", played: 11, wins: 6, loses: 2,
  venue: { played: 6, win: 4, draw: 1, lose: 1, goals_for: 12, goals_against: 5 },
  goals_for_avg: 1.8, goals_against_avg: 1.1, xg_for_avg: 1.72, clean_sheet_pct: 27, failed_to_score_pct: 18,
  formation: { name: "4-2-3-1", played: 8 }, lineup: null, streaks: { wins: 4, draws: 2, loses: 1 },
  minutes: { for: [2, 3, 4, 3, 2, 6], against: [1, 2, 1, 4, 2, 2] },
  ...over,
});

export const DERBY_CONTEXT: MatchContext = {
  fetched_at: "2026-11-08T08:05:00Z", source: "api-football", season: 2026,
  standings: { home: { rank: 3, points: 21, played: 11, goals_diff: 8 }, away: { rank: 5, points: 19, played: 11, goals_diff: 4 }, league_goals_avg: 1.4 },
  teams: {
    home: team({ lineup: DERBY_HOME_XI }),
    away: team({
      lineup: DERBY_AWAY_XI,
      form: "DWLWDWL", wins: 5, loses: 2, venue: { played: 5, win: 2, draw: 2, lose: 1, goals_for: 8, goals_against: 7 },
      goals_for_avg: 1.6, goals_against_avg: 1.2, xg_for_avg: 1.55, clean_sheet_pct: 18, failed_to_score_pct: 9,
      formation: { name: "4-3-3", played: 7 }, streaks: { wins: 3, draws: 2, loses: 2 },
      minutes: { for: [1, 2, 3, 5, 3, 4], against: [3, 2, 2, 1, 2, 3] },
    }),
  },
  absences: {
    home: [
      { player_id: 90012, name: "Yedek Kanat", status: "injured", minutes: 612, goals: 2, assists: 3, involvement_pct: 16 },
    ],
    away: [
      { player_id: 90022, name: "Yedek Orta", status: "suspended", minutes: 880, goals: 1, assists: 5, involvement_pct: 22 },
      { player_id: 90021, name: "Örnek Golcü", status: "doubtful", minutes: 1192, goals: 8, assists: 2, involvement_pct: 37 },
    ],
  },
  h2h: { played: 10, home_wins: 4, draws: 3, away_wins: 3, avg_goals: 2.9 },
  polished: null,
};

export const FAVOURITE_CONTEXT: MatchContext = {
  fetched_at: "2026-11-09T08:05:00Z", source: "api-football", season: 2026,
  standings: { home: { rank: 1, points: 28, played: 11, goals_diff: 21 }, away: { rank: 15, points: 9, played: 11, goals_diff: -11 }, league_goals_avg: 1.4 },
  teams: {
    home: team({
      form: "WWWDWWW", wins: 9, loses: 1, venue: { played: 6, win: 5, draw: 1, lose: 0, goals_for: 17, goals_against: 3 },
      goals_for_avg: 2.6, goals_against_avg: 0.7, xg_for_avg: 2.41, clean_sheet_pct: 55, failed_to_score_pct: 0,
      formation: { name: "4-3-3", played: 10 }, streaks: { wins: 6, draws: 1, loses: 1 },
      minutes: { for: [4, 5, 6, 3, 5, 6], against: [1, 1, 2, 1, 1, 2] },
    }),
    away: team({
      form: "LLDLWLL", wins: 2, loses: 6, venue: { played: 5, win: 0, draw: 1, lose: 4, goals_for: 3, goals_against: 11 },
      goals_for_avg: 0.9, goals_against_avg: 1.9, xg_for_avg: 0.94, clean_sheet_pct: 9, failed_to_score_pct: 36,
      formation: { name: "5-4-1", played: 6 }, streaks: { wins: 1, draws: 1, loses: 4 },
      minutes: { for: [1, 1, 2, 1, 2, 3], against: [3, 3, 4, 3, 4, 4] },
    }),
  },
  absences: { home: [], away: [{ player_id: 90041, name: "Kurgu Santrfor", status: "doubtful", minutes: 1010, goals: 4, assists: 1, involvement_pct: 33 }] },
  h2h: { played: 8, home_wins: 6, draws: 1, away_wins: 1, avg_goals: 3.1 },
  polished: null,
};
