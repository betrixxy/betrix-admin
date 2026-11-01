/**
 * Senaryo girdisi: reels-service sözleşme v1 + ihtiyaç duyulan v1.1 alanları (`docs/contract-v1.1-ihtiyac.md`).
 * Alan adları sözleşme dilindedir. Eksik veri `null`: ilgili sahne kendini devre dışı bırakır.
 */

export interface TeamForm {
  /** En yeni başta; W/D/L. */
  last5: string | null;
  goals_for: number | null;
  goals_against: number | null;
  xg_for: number | null;
  xg_against: number | null;
  /** 0–1 */
  clean_sheet_rate: number | null;
  btts_rate: number | null;
  /** Son Avrupa maçından bu yana gün; 99 ve üzeri "Avrupa'da oynamadı". */
  euro_fatigue_days: number | null;
}

export interface MatchData {
  contract_version: string;
  match: {
    id: number;
    kickoff_utc: string;
    league: { id: number; name: string; round: string | null };
    referee: string | null;
    venue: string | null;
  };
  teams: Record<"home" | "away", { id: number; name: string; short_name: string; logo: string; colors: { primary: string; secondary: string } }>;
  model: { version: string; computed_at: string; simulations: number | null };
  outcome: { home_win: number; draw: number; away_win: number };
  score_distribution: { home_goals: number; away_goals: number; p: number }[];
  score_scene_allowed: boolean;
  goals: { three_plus: number | null };
  both_score: number | null;
  /** Her takımın gol bulma olasılığı; yoksa null. */
  team_goal_chance: { home: number; away: number } | null;
  first_goal: { home: number | null; away: number | null; none: number | null };
  season_xg_leaders: {
    home: { name: string; season_goals: number; season_xg: number; season_games: number }[];
    away: { name: string; season_goals: number; season_xg: number; season_games: number }[];
    data_updated_at: { home: string | null; away: string | null };
  };
  season_xg_fresh: boolean;
  form: { home: TeamForm; away: TeamForm };
  h2h: {
    played: number | null;
    home_wins: number | null;
    draws: number | null;
    away_wins: number | null;
    avg_goals: number | null;
    /** En yeni başta. */
    matches: { date: string; home: string; away: string; home_score: number; away_score: number }[];
  };
  /** Yalnız başlama öncesi hesaplardan; yetersizse boş. */
  model_track_record: { from: number; to: number; matches: number; hit_rate: number }[];
}
