import { DERBY_CONTEXT, FAVOURITE_CONTEXT } from "./context";
import { buildTimeline } from "../lib/motion";
import type { MatchData, MatchPlayers, PlayerSeason } from "../story/match-data";
import { buildScript, evaluatePool, BRAND, pickStory, type StoryAngle } from "../story/pool";
import { ACTIVE_DESIGN, reelScriptSchema, type DesignDirection, type ReelScript, type ReelScene } from "../schema";

/** İki KURGUSAL örnek: takımlar, kişiler ve sayılar uydurmadır. Biri derbi havası, biri ezici favori. */

const TRACK_RECORD = { source: "sample" as const, completed_matches: 2228, buckets: [
  { from: 20, to: 30, matches: 318, hit_rate: 0.26 },
  { from: 30, to: 40, matches: 642, hit_rate: 0.36 },
  { from: 40, to: 50, matches: 571, hit_rate: 0.44 },
  { from: 50, to: 60, matches: 389, hit_rate: 0.53 },
  { from: 60, to: 70, matches: 212, hit_rate: 0.64 },
  { from: 70, to: 80, matches: 96, hit_rate: 0.73 },
] };

const season = (id: number, name: string, teamId: number, appearances: number, minutes: number, goals: number, assists: number, shots: number, onTarget: number, keyPasses: number): PlayerSeason =>
  ({ id, name, team_id: teamId, appearances, minutes, goals, assists, shots, shots_on_target: onTarget, key_passes: keyPasses });

const DERBY_PLAYERS: MatchPlayers = {
  squad_checked_at: "2026-11-08T07:30:00Z",
  squads: {
    home: [{ id: 90011, name: "Kurgu Forvet" }, { id: 90012, name: "Yedek Kanat" }],
    away: [{ id: 90021, name: "Örnek Golcü" }, { id: 90022, name: "Yedek Orta" }],
  },
  candidates: {
    home: [season(90011, "Kurgu Forvet", 9001, 13, 1084, 9, 4, 41, 21, 18), season(90012, "Yedek Kanat", 9001, 11, 612, 2, 3, 14, 6, 15)],
    away: [season(90021, "Örnek Golcü", 9002, 14, 1192, 8, 2, 37, 16, 11), season(90022, "Yedek Orta", 9002, 12, 880, 1, 5, 12, 4, 24)],
  },
  vs_opponent: [{
    player_id: 90011,
    matches: [
      { date: "2024-04-21", club_id: 9004, club_name: "Liman Spor", club_logo: "placeholders/crest-liman.svg", opponent_name: "Anadolu Gücü", score: "2–2", minutes: 90, goals: 1, assists: 0 },
      { date: "2024-11-03", club_id: 9001, club_name: "Boğaziçi SK", club_logo: "placeholders/crest-bogazici.svg", opponent_name: "Anadolu Gücü", score: "1–0", minutes: 84, goals: 1, assists: 0 },
      { date: "2025-04-06", club_id: 9001, club_name: "Boğaziçi SK", club_logo: "placeholders/crest-bogazici.svg", opponent_name: "Anadolu Gücü", score: "2–3", minutes: 90, goals: 1, assists: 1 },
      { date: "2025-10-19", club_id: 9001, club_name: "Boğaziçi SK", club_logo: "placeholders/crest-bogazici.svg", opponent_name: "Anadolu Gücü", score: "2–1", minutes: 78, goals: 0, assists: 1 },
      { date: "2026-03-14", club_id: 9001, club_name: "Boğaziçi SK", club_logo: "placeholders/crest-bogazici.svg", opponent_name: "Anadolu Gücü", score: "1–1", minutes: 90, goals: 1, assists: 0 },
    ],
  }],
};

const FAVOURITE_PLAYERS: MatchPlayers = {
  squad_checked_at: "2026-11-09T07:30:00Z",
  squads: {
    home: [{ id: 90031, name: "Örnek Kanat" }],
    away: [{ id: 90041, name: "Kurgu Santrfor" }],
  },
  candidates: {
    home: [season(90031, "Örnek Kanat", 9003, 15, 1260, 12, 7, 52, 28, 31)],
    away: [season(90041, "Kurgu Santrfor", 9004, 13, 1010, 4, 1, 22, 8, 7)],
  },
  // İki maç: hikâye eşiğinin altında, "Rakibine karşı" kapalı kalır.
  vs_opponent: [{
    player_id: 90031,
    matches: [
      { date: "2025-09-28", club_id: 9003, club_name: "Kuzey Yıldızı", club_logo: "placeholders/crest-kuzey.svg", opponent_name: "Liman Spor", score: "3–1", minutes: 90, goals: 1, assists: 1 },
      { date: "2026-02-22", club_id: 9003, club_name: "Kuzey Yıldızı", club_logo: "placeholders/crest-kuzey.svg", opponent_name: "Liman Spor", score: "2–0", minutes: 88, goals: 1, assists: 0 },
    ],
  }],
};

export const DERBY: MatchData = {
  contract_version: "1.2",
  match: { id: 900001, kickoff_utc: "2026-11-08T17:00:00Z", league: { id: 203, name: "Kurgu Ligi", round: "11. Hafta" }, referee: "Kurgu Hakem", venue: "Boğaz Arena" },
  teams: {
    home: { id: 9001, name: "Boğaziçi SK", short_name: "Boğaziçi", logo: "placeholders/crest-bogazici.svg", colors: { primary: "#E2263F", secondary: "#FFD6DB" } },
    away: { id: 9002, name: "Anadolu Gücü", short_name: "Anadolu", logo: "placeholders/crest-anadolu.svg", colors: { primary: "#2F80ED", secondary: "#D5E7FF" } },
  },
  model: { version: "2.1.0", computed_at: "2026-11-08T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.38, draw: 0.3, away_win: 0.32 },
  outcome_double: { home_or_draw: 0.68, draw_or_away: 0.62 },
  comfortable_win: { home: 0.16, away: 0.13 },
  score_distribution: [
    { home_goals: 1, away_goals: 1, p: 0.14 }, { home_goals: 2, away_goals: 1, p: 0.11 }, { home_goals: 1, away_goals: 0, p: 0.1 },
    { home_goals: 1, away_goals: 2, p: 0.09 }, { home_goals: 0, away_goals: 1, p: 0.08 },
  ],
  score_scene_allowed: true,
  goals: { two_plus: 0.78, three_plus: 0.57, four_plus: 0.33, five_plus: 0.16, distribution: null },
  both_score: 0.62,
  team_goal_chance: { home: 0.78, away: 0.72 },
  team_two_plus: { home: 0.4, away: 0.34 },
  clean_win: { home: 0.11, away: 0.08 },
  first_half: { home: 0.3, draw: 0.44, away: 0.26, any_goal: 0.72, two_plus: 0.36 },
  half_most_goals: { first: 0.31, second: 0.45, equal: 0.24 },
  comeback: { home: 0.05, away: 0.04 },
  first_goal: { home: 0.46, away: 0.44, none: 0.1 },
  corners: { more: { home: 0.46, away: 0.41, equal: 0.13 }, nine_plus: 0.62, ten_plus: 0.47, eleven_plus: 0.33 },
  cards: { four_plus: 0.71, five_plus: 0.52, six_plus: 0.33, red_card: 0.19 },
  penalty: 0.27,
  scorer_chances: [
    { player_id: 90011, side: "home", name: "Kurgu Forvet", p: 0.34 },
    { player_id: 90021, side: "away", name: "Örnek Golcü", p: 0.29 },
    { player_id: 90012, side: "home", name: "Yedek Kanat", p: 0.14 },
  ],
  players: DERBY_PLAYERS,
  context: DERBY_CONTEXT,
  analyst_note: null,
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
  contract_version: "1.2",
  match: { id: 900002, kickoff_utc: "2026-11-09T17:00:00Z", league: { id: 203, name: "Kurgu Ligi", round: "11. Hafta" }, referee: "Kurgu Hakem", venue: "Kuzey Stadyumu" },
  teams: {
    home: { id: 9003, name: "Kuzey Yıldızı", short_name: "Kuzey", logo: "placeholders/crest-kuzey.svg", colors: { primary: "#F5B700", secondary: "#FFF0C2" } },
    away: { id: 9004, name: "Liman Spor", short_name: "Liman", logo: "placeholders/crest-liman.svg", colors: { primary: "#9B5DE5", secondary: "#E9DBFA" } },
  },
  model: { version: "2.1.0", computed_at: "2026-11-09T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.74, draw: 0.17, away_win: 0.09 },
  outcome_double: { home_or_draw: 0.91, draw_or_away: 0.26 },
  comfortable_win: { home: 0.5, away: 0.02 },
  score_distribution: [
    { home_goals: 2, away_goals: 0, p: 0.15 }, { home_goals: 3, away_goals: 0, p: 0.12 }, { home_goals: 2, away_goals: 1, p: 0.11 },
    { home_goals: 1, away_goals: 0, p: 0.1 }, { home_goals: 3, away_goals: 1, p: 0.08 },
  ],
  score_scene_allowed: true,
  goals: { two_plus: 0.9, three_plus: 0.71, four_plus: 0.46, five_plus: 0.26, distribution: null },
  both_score: 0.41,
  team_goal_chance: { home: 0.91, away: 0.46 },
  team_two_plus: { home: 0.72, away: 0.12 },
  clean_win: { home: 0.5, away: 0.03 },
  first_half: { home: 0.55, draw: 0.34, away: 0.11, any_goal: 0.8, two_plus: 0.48 },
  half_most_goals: { first: 0.33, second: 0.46, equal: 0.21 },
  comeback: { home: 0.07, away: 0.01 },
  first_goal: { home: 0.68, away: 0.23, none: 0.09 },
  corners: { more: { home: 0.66, away: 0.22, equal: 0.12 }, nine_plus: 0.66, ten_plus: 0.52, eleven_plus: 0.38 },
  cards: { four_plus: 0.58, five_plus: 0.39, six_plus: 0.22, red_card: 0.12 },
  penalty: 0.31,
  scorer_chances: [{ player_id: 90031, side: "home", name: "Örnek Kanat", p: 0.48 }, { player_id: 90041, side: "away", name: "Kurgu Santrfor", p: 0.17 }],
  players: FAVOURITE_PLAYERS,
  context: FAVOURITE_CONTEXT,
  analyst_note: null,
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

const SAMPLE_MATCHES = { derbi: { data: DERBY, angle: "derby" }, favori: { data: FAVOURITE, angle: "favourite" } } as const satisfies Record<string, { data: MatchData; angle: StoryAngle }>;
export type SampleKey = keyof typeof SAMPLE_MATCHES;
export const SAMPLE_KEYS = Object.keys(SAMPLE_MATCHES) as SampleKey[];
export const SAMPLE_OPTIONS = { allowSampleTrackRecord: true, allowScorerScene: true } as const;

/** Seçilen hikâye (video) ve bütün havuz (tek kareler) aynı veriden. */
export function sampleScripts(key: SampleKey, design: DesignDirection = ACTIVE_DESIGN): { story: ReelScript; pool: ReelScript } {
  const { data, angle } = SAMPLE_MATCHES[key];
  const entries = evaluatePool(data, BRAND, SAMPLE_OPTIONS);
  const disabled = entries.flatMap((entry) => (entry.reason ? [{ type: entry.type, reason: entry.reason }] : []));
  const ready = entries.flatMap((entry) => (entry.scene ? [entry.scene] : []));
  return {
    story: reelScriptSchema.parse(buildScript(data, pickStory(entries, angle), disabled, design)),
    pool: reelScriptSchema.parse(buildScript(data, ready, disabled, design)),
  };
}

/** Pano: Kapak, Monte Carlo (3 evre), Eksikler, Takım analizi, İki takım da gol bulur mu?, checkmatch senaryosu. */
export const BOARD_SCENES = ["S01_COVER", "M02_MONTE_CARLO", "C03_ABSENCES", "C04_TEAM_HOME", "Q05_BOTH_SCORE", "C09_SCENARIO"] as const;

/** Panoda analist notlu kart da görünsün. Kurgusal. */
const BOARD_NOTE = "Kurgusal not: Maçı ilk golü bulan taraf yönetir. İki takım da savunma arkasına koşularla oynuyor, bu yüzden ilk yarım saat belirleyici.";

export function boardScript(design: DesignDirection): ReelScript {
  const data = { ...DERBY, analyst_note: BOARD_NOTE };
  const entries = evaluatePool(data, BRAND, SAMPLE_OPTIONS);
  const ready = entries.flatMap((entry) => (entry.scene ? [entry.scene] : []));
  const scenes = BOARD_SCENES.flatMap((type) => ready.filter((scene) => scene.type === type));
  return reelScriptSchema.parse(buildScript(data, scenes, [], design));
}

/** Tek sahnelik senaryo: Monte Carlo kısa MP4'ü. */
export function singleSceneScript(type: ReelScene["type"]): ReelScript {
  const script = boardScript(ACTIVE_DESIGN);
  const scenes = evaluatePool({ ...DERBY, analyst_note: BOARD_NOTE }, BRAND, SAMPLE_OPTIONS).flatMap((entry) => (entry.scene?.type === type ? [entry.scene] : []));
  return reelScriptSchema.parse({ ...script, scenes });
}

/** Tam akış: derbi hikâyesi, analist notlu. 17 adımın hepsi + açının eklediği sahne. */
export function flowScript(): ReelScript {
  const data = { ...DERBY, analyst_note: BOARD_NOTE };
  const entries = evaluatePool(data, BRAND, SAMPLE_OPTIONS);
  return reelScriptSchema.parse(buildScript(data, pickStory(entries, "derby"), [], ACTIVE_DESIGN));
}

export const storySeconds = (script: ReelScript): number => buildTimeline(script.scenes.map((scene) => scene.durationInFrames)).total / 30;
