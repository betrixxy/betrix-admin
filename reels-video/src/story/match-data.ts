/**
 * Senaryo girdisi: reels-service sözleşme v1 + v1.2 ihtiyaçları (`docs/contract-v1.2-ihtiyac.md`) + betrix'in eklediği
 * oyuncu/kadro bloğu. Alan adları nötrdür, market adı taşımaz. Eksik veri `null`: ilgili sahne kendini kapatır.
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

export type Side = "home" | "away";
export type SidePair<T> = Record<Side, T>;

/** API-Football sezon toplamı. Bilinmeyen istatistik `null`: satır düşer, 0 yazılmaz. */
export interface PlayerSeason {
  id: number;
  name: string;
  team_id: number;
  appearances: number;
  minutes: number;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  key_passes: number | null;
}

export interface OpponentMatch {
  /** ISO tarih. */
  date: string;
  /** O maçta oyuncunun kulübü. */
  club_id: number;
  club_name: string;
  club_logo: string | null;
  opponent_name: string;
  /** Oyuncunun kulübü önce: "2–1". */
  score: string;
  minutes: number;
  goals: number;
  assists: number;
}

export interface PlayerVsOpponent {
  player_id: number;
  /** Sahaya çıktığı maçlar; sıra önemsiz, kural tarihe göre dizer. */
  matches: OpponentMatch[];
}

export interface MatchPlayers {
  /** Kadro kaynağının son yenilenme zamanı. `null`: doğrulanamadı, hiçbir oyuncu videoya girmez. */
  squad_checked_at: string | null;
  /** API-Football güncel kadro. */
  squads: SidePair<{ id: number; name: string }[]>;
  candidates: SidePair<PlayerSeason[]>;
  vs_opponent: PlayerVsOpponent[];
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
  teams: SidePair<{ id: number; name: string; short_name: string; logo: string; colors: { primary: string; secondary: string } }>;
  model: { version: string; computed_at: string; simulations: number | null };
  outcome: { home_win: number; draw: number; away_win: number };
  /** Çifte şans. */
  outcome_double: { home_or_draw: number; draw_or_away: number } | null;
  /** 2+ farkla galibiyet. */
  comfortable_win: SidePair<number | null>;
  score_distribution: { home_goals: number; away_goals: number; p: number }[];
  score_scene_allowed: boolean;
  /** Gol merdiveni. `distribution`: simülasyonun toplam gol dağılımı (0, 1, 2, 3, 4, 5+); yoksa merdivenden türetilir. */
  goals: { two_plus: number | null; three_plus: number | null; four_plus: number | null; five_plus: number | null; distribution: number[] | null };
  both_score: number | null;
  /** Her takımın gol bulma olasılığı; yoksa null. */
  team_goal_chance: SidePair<number> | null;
  team_two_plus: SidePair<number | null>;
  /** Gol yemeden kazanma. */
  clean_win: SidePair<number | null>;
  first_half: { home: number | null; draw: number | null; away: number | null; any_goal: number | null; two_plus: number | null };
  half_most_goals: { first: number; second: number; equal: number } | null;
  /** İlk yarıda geride, maç sonunda galip. */
  comeback: SidePair<number | null>;
  first_goal: { home: number | null; away: number | null; none: number | null };
  corners: { more: { home: number; away: number; equal: number } | null; nine_plus: number | null; ten_plus: number | null; eleven_plus: number | null };
  cards: { four_plus: number | null; five_plus: number | null; six_plus: number | null; red_card: number | null };
  penalty: number | null;
  /** Modele giren veri grupları. `sample`: yalnız örneklerde; gerçek liste gelene kadar gerçek akışta sahne kapalı. */
  model_inputs: { source: "service" | "sample"; groups: { label: string; value: string }[] } | null;
  /** Golcü şablonu için; golcü modeli düzeltilene kadar gerçek akışta kapalı. */
  scorer_chances: { player_id: number; side: Side; name: string; p: number }[];
  players: MatchPlayers;
  form: SidePair<TeamForm>;
  h2h: {
    played: number | null;
    home_wins: number | null;
    draws: number | null;
    away_wins: number | null;
    avg_goals: number | null;
    /** En yeni başta. */
    matches: { date: string; home: string; away: string; home_score: number; away_score: number }[];
  };
  /**
   * Modelin karnesi. Kaynak: betrix'te ReelSnapshot + maç sonucu (sözleşmede değil). `sample` yalnız örneklerde.
   * Eşikler `story/track-record.ts`.
   */
  model_track_record: {
    source: "reel_snapshot" | "sample";
    completed_matches: number;
    buckets: { from: number; to: number; matches: number; hit_rate: number }[];
  } | null;
}
