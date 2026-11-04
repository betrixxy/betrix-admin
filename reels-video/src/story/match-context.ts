/**
 * Futbol okuması: API-Football'dan dondurma anında alınır, `ReelSnapshot.context`e yazılır. checkmatch oyuncu ve puan
 * durumu verisi kullanılmaz. Olasılıklar ayrı kaynaktan (`MatchData`). Eksik alan `null`: ilgili satır ya da sahne kapanır,
 * 0 yazılmaz. Üreten taraf: `src/lib/reels/context-rule.ts`.
 */

export const GOAL_SLOTS = ["0–15", "16–30", "31–45", "46–60", "61–75", "76–90+"] as const;

export interface VenueRecord {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
}

export interface StandingLine {
  rank: number;
  points: number;
  played: number;
  goals_diff: number;
}

export interface TeamContext {
  /** Sezon form dizisi, en yeni sonda; W/D/L. */
  form: string | null;
  played: number;
  wins: number;
  loses: number;
  /** İç saha ya da deplasman: maçtaki tarafına göre. */
  venue: VenueRecord | null;
  goals_for_avg: number | null;
  goals_against_avg: number | null;
  /** Sezon maç başı xG; en az 5 lig maçı yoksa null. */
  xg_for_avg: number | null;
  /** 0–100, oynanan maça göre. */
  clean_sheet_pct: number | null;
  failed_to_score_pct: number | null;
  formation: { name: string; played: number } | null;
  /** En uzun seriler: form dizisinden sayılır. */
  streaks: { wins: number; draws: number; loses: number };
  /** `GOAL_SLOTS` sırasıyla 6 dilim; 91–105 son dilime eklenir. */
  minutes: { for: (number | null)[]; against: (number | null)[] };
}

export type AbsenceStatus = "injured" | "suspended" | "doubtful";

export interface Absence {
  player_id: number;
  name: string;
  status: AbsenceStatus;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  /** Takımın gol + asist toplamındaki pay, 0–100. Hesaplanamazsa null. */
  involvement_pct: number | null;
}

export interface MatchContext {
  fetched_at: string;
  source: "api-football";
  season: number;
  standings: { home: StandingLine | null; away: StandingLine | null; league_goals_avg: number | null };
  teams: { home: TeamContext; away: TeamContext };
  absences: { home: Absence[]; away: Absence[] } | null;
  h2h: { played: number; home_wins: number; draws: number; away_wins: number; avg_goals: number | null } | null;
  /** LLM'in doğallaştırdığı şablonlar, `claim` kimliğiyle. Yoksa ya da denetimden geçmiyorsa kod şablonu kullanılır. */
  polished: Record<string, string> | null;
}
