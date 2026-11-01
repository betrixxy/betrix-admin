import type { MatchData } from "../story/match-data";
import { buildScript, evaluatePool, BRAND, pickStory, type StoryAngle } from "../story/pool";
import { reelScriptSchema, type ReelScript } from "../schema";

/** İki KURGUSAL örnek: takımlar, kişiler ve sayılar uydurmadır. Biri derbi havası, biri ezici favori. */

const TRACK_RECORD = { source: "sample" as const, completed_matches: 2228, buckets: [
  { from: 20, to: 30, matches: 318, hit_rate: 0.26 },
  { from: 30, to: 40, matches: 642, hit_rate: 0.36 },
  { from: 40, to: 50, matches: 571, hit_rate: 0.44 },
  { from: 50, to: 60, matches: 389, hit_rate: 0.53 },
  { from: 60, to: 70, matches: 212, hit_rate: 0.64 },
  { from: 70, to: 80, matches: 96, hit_rate: 0.73 },
] };

export const DERBY: MatchData = {
  contract_version: "1.1",
  match: { id: 900001, kickoff_utc: "2026-11-08T17:00:00Z", league: { id: 203, name: "Kurgu Ligi", round: "11. Hafta" }, referee: "Kurgu Hakem", venue: "Boğaz Arena" },
  teams: {
    home: { id: 9001, name: "Boğaziçi SK", short_name: "Boğaziçi", logo: "placeholders/crest-bogazici.svg", colors: { primary: "#E2263F", secondary: "#FFD6DB" } },
    away: { id: 9002, name: "Anadolu Gücü", short_name: "Anadolu", logo: "placeholders/crest-anadolu.svg", colors: { primary: "#2F80ED", secondary: "#D5E7FF" } },
  },
  model: { version: "2.1.0", computed_at: "2026-11-08T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.38, draw: 0.3, away_win: 0.32 },
  score_distribution: [
    { home_goals: 1, away_goals: 1, p: 0.14 }, { home_goals: 2, away_goals: 1, p: 0.11 }, { home_goals: 1, away_goals: 0, p: 0.1 },
    { home_goals: 1, away_goals: 2, p: 0.09 }, { home_goals: 0, away_goals: 1, p: 0.08 },
  ],
  score_scene_allowed: true,
  goals: { three_plus: 0.57 },
  both_score: 0.62,
  team_goal_chance: { home: 0.78, away: 0.72 },
  first_goal: { home: 0.46, away: 0.44, none: 0.1 },
  season_xg_leaders: {
    home: [{ name: "Kurgu Forvet", season_goals: 7, season_xg: 6.42, season_games: 10 }],
    away: [{ name: "Örnek Golcü", season_goals: 6, season_xg: 5.81, season_games: 11 }],
    data_updated_at: { home: "2026-11-05T05:00:00Z", away: "2026-11-05T05:00:00Z" },
  },
  season_xg_fresh: true,
  form: {
    home: { last5: "WDWLW", goals_for: 1.8, goals_against: 1.1, xg_for: 1.72, xg_against: 1.08, clean_sheet_rate: 0.3, btts_rate: 0.6, euro_fatigue_days: 3.4 },
    away: { last5: "DWWDL", goals_for: 1.6, goals_against: 1.2, xg_for: 1.55, xg_against: 1.21, clean_sheet_rate: 0.2, btts_rate: 0.7, euro_fatigue_days: 99 },
  },
  h2h: {
    played: 10, home_wins: 4, draws: 3, away_wins: 3, avg_goals: 2.9,
    matches: [
      { date: "2026-03-14", home: "Anadolu Gücü", away: "Boğaziçi SK", home_score: 1, away_score: 1 },
      { date: "2025-10-19", home: "Boğaziçi SK", away: "Anadolu Gücü", home_score: 2, away_score: 1 },
      { date: "2025-04-06", home: "Anadolu Gücü", away: "Boğaziçi SK", home_score: 3, away_score: 2 },
      { date: "2024-11-03", home: "Boğaziçi SK", away: "Anadolu Gücü", home_score: 1, away_score: 0 },
      { date: "2024-04-21", home: "Anadolu Gücü", away: "Boğaziçi SK", home_score: 2, away_score: 2 },
    ],
  },
  model_track_record: TRACK_RECORD,
};

export const FAVOURITE: MatchData = {
  contract_version: "1.1",
  match: { id: 900002, kickoff_utc: "2026-11-09T17:00:00Z", league: { id: 203, name: "Kurgu Ligi", round: "11. Hafta" }, referee: "Kurgu Hakem", venue: "Kuzey Stadyumu" },
  teams: {
    home: { id: 9003, name: "Kuzey Yıldızı", short_name: "Kuzey", logo: "placeholders/crest-kuzey.svg", colors: { primary: "#F5B700", secondary: "#FFF0C2" } },
    away: { id: 9004, name: "Liman Spor", short_name: "Liman", logo: "placeholders/crest-liman.svg", colors: { primary: "#9B5DE5", secondary: "#E9DBFA" } },
  },
  model: { version: "2.1.0", computed_at: "2026-11-09T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.74, draw: 0.17, away_win: 0.09 },
  score_distribution: [
    { home_goals: 2, away_goals: 0, p: 0.15 }, { home_goals: 3, away_goals: 0, p: 0.12 }, { home_goals: 2, away_goals: 1, p: 0.11 },
    { home_goals: 1, away_goals: 0, p: 0.1 }, { home_goals: 3, away_goals: 1, p: 0.08 },
  ],
  score_scene_allowed: true,
  goals: { three_plus: 0.71 },
  both_score: 0.41,
  team_goal_chance: { home: 0.91, away: 0.46 },
  first_goal: { home: 0.68, away: 0.23, none: 0.09 },
  season_xg_leaders: {
    home: [{ name: "Örnek Kanat", season_goals: 11, season_xg: 9.37, season_games: 11 }],
    away: [{ name: "Kurgu Santrfor", season_goals: 3, season_xg: 3.12, season_games: 10 }],
    data_updated_at: { home: "2026-11-05T05:00:00Z", away: "2026-11-05T05:00:00Z" },
  },
  season_xg_fresh: true,
  form: {
    home: { last5: "WWWDW", goals_for: 2.6, goals_against: 0.7, xg_for: 2.41, xg_against: 0.82, clean_sheet_rate: 0.5, btts_rate: 0.4, euro_fatigue_days: 4.1 },
    away: { last5: "LLDLW", goals_for: 0.9, goals_against: 1.9, xg_for: 0.94, xg_against: 1.87, clean_sheet_rate: 0.1, btts_rate: 0.5, euro_fatigue_days: 99 },
  },
  h2h: {
    played: 8, home_wins: 6, draws: 1, away_wins: 1, avg_goals: 3.1,
    matches: [
      { date: "2026-02-22", home: "Liman Spor", away: "Kuzey Yıldızı", home_score: 0, away_score: 2 },
      { date: "2025-09-28", home: "Kuzey Yıldızı", away: "Liman Spor", home_score: 3, away_score: 1 },
      { date: "2025-03-16", home: "Liman Spor", away: "Kuzey Yıldızı", home_score: 1, away_score: 1 },
      { date: "2024-10-27", home: "Kuzey Yıldızı", away: "Liman Spor", home_score: 4, away_score: 0 },
    ],
  },
  model_track_record: TRACK_RECORD,
};

const SAMPLE_INPUTS = { derbi: { data: DERBY, angle: "derby" }, favori: { data: FAVOURITE, angle: "favourite" } } as const satisfies Record<string, { data: MatchData; angle: StoryAngle }>;
export type SampleKey = keyof typeof SAMPLE_INPUTS;
export const SAMPLE_KEYS = Object.keys(SAMPLE_INPUTS) as SampleKey[];

/** Seçilen hikâye (video) ve bütün havuz (tek kareler) aynı veriden. */
export function sampleScripts(key: SampleKey): { story: ReelScript; pool: ReelScript } {
  const { data, angle } = SAMPLE_INPUTS[key];
  const entries = evaluatePool(data, BRAND, { allowSampleTrackRecord: true });
  const disabled = entries.flatMap((entry) => (entry.reason ? [{ type: entry.type, reason: entry.reason }] : []));
  const ready = entries.flatMap((entry) => (entry.scene ? [entry.scene] : []));
  return {
    story: reelScriptSchema.parse(buildScript(data, pickStory(entries, angle), disabled)),
    pool: reelScriptSchema.parse(buildScript(data, ready, disabled)),
  };
}
