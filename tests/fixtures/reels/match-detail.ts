import type { ReelsCheck, ReelsMatchDetail } from "@/lib/services/reels-schema";

/** Sözleşme v1 ile birebir kurgusal yanıt. Testler yalnız ilgili alanı değiştirir. */

export const reelsCheck = (name: string, ok = true): ReelsCheck => ({ name, ok, detail: "Kurgusal ayrıntı" });

const CHECKS: ReelsCheck[] = [
  "outcome_sum", "computed_at_fresh", "score_distribution_aligned", "models_disagree",
  "scene_both_score_close", "scene_three_plus_close", "scene_nil_nil_within_first_goal",
  "player_data_fresh", "scorer_value_within_team_chance", "probabilities_in_range", "season_xg_fresh",
].map((name) => reelsCheck(name));

export function reelsMatchFixture(overrides: Partial<ReelsMatchDetail> = {}): ReelsMatchDetail {
  return {
    contract_version: "1.0",
    match: {
      id: 1001,
      kickoff_utc: "2026-11-08T16:00:00Z",
      league: { id: 203, name: "Kurgu Ligi", round: "Regular Season - 11" },
      referee: "A. Hakem",
    },
    teams: {
      home: { id: 1, name: "Kurgu Spor", logo_url: "https://media.api-sports.io/football/teams/1.png" },
      away: { id: 2, name: "Örnek FK", logo_url: null },
    },
    model: { version: "2.1.0", computed_at: "2026-11-07T11:09:44.446195Z", simulations: 500000 },
    outcome: { home_win: 0.45, draw: 0.28, away_win: 0.27 },
    score_distribution: [{ home_goals: 1, away_goals: 1, p: 0.12 }],
    score_distribution_basis: "aligned_to_outcome",
    score_scene_allowed: true,
    goals: { three_plus: 0.52 },
    recent_xg: { home: 1.4, away: 1.1, window: "Son 10 maç" },
    both_score: 0.55,
    first_goal: { home: 0.5, away: 0.4, none: 0.1 },
    scorers: [],
    season_xg_leaders: {
      home: [{ name: "Kurgu Oyuncu", season_goals: 3, season_xg: 2.5, season_games: 7, season_year: 2026 }],
      away: [],
      data_updated_at: { home: "2026-11-05T05:00:00Z", away: null },
    },
    form: { home: "WWDLW", away: "LDW" },
    h2h: { played: 5, home_wins: 2, draws: 2, away_wins: 1 },
    quality: { stale: false, checks: CHECKS },
    ...overrides,
  };
}

/** Bir kontrolün sonucunu değiştirilmiş yanıt. */
export function withCheck(name: string, ok: boolean): ReelsMatchDetail {
  const base = reelsMatchFixture();
  return { ...base, quality: { ...base.quality, checks: base.quality.checks.map((check) => (check.name === name ? { ...check, ok } : check)) } };
}
