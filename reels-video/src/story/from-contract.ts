import type { MatchContext } from "./match-context";
import type { MatchData, MatchPlayers, TeamForm } from "./match-data";

/**
 * Sözleşme v1 (reels-service) + dondurulan API-Football okuması → `MatchData`. Saf. v1'de olmayan alan `null` kalır, ilgili sahne
 * kendini kapatır (`market-checks.ts`). Sayı uydurulmaz, türetilmez.
 */

/** `reels-schema.ts::ReelsMatchDetail` alt kümesi. Doğrulama çağıran tarafta. */
export interface ContractDetail {
  contract_version: string;
  match: { id: number; kickoff_utc: string; league: { id: number; name: string; round: string | null }; referee: string | null };
  model: { version: string; computed_at: string; simulations: number | null };
  outcome: { home_win: number; draw: number; away_win: number };
  score_distribution: { home_goals: number; away_goals: number; p: number }[];
  score_scene_allowed: boolean;
  goals: { three_plus: number | null };
  recent_xg: { home: number | null; away: number | null };
  both_score: number | null;
  first_goal: { home: number | null; away: number | null; none: number | null };
  form: { home: string | null; away: string | null };
  h2h: { played: number | null; home_wins: number | null; draws: number | null; away_wins: number | null };
}

export interface SideInfo {
  id: number;
  name: string;
  short_name: string;
  logo: string;
  colors: { primary: string; secondary: string };
}

export interface FrozenExtras {
  league_name: string;
  round: string | null;
  venue: string | null;
  referee: string | null;
  teams: { home: SideInfo; away: SideInfo };
  players: MatchPlayers;
  context: MatchContext | null;
  /** API-Football, en yeni başta. */
  h2h_matches: MatchData["h2h"]["matches"];
}

const blankForm = (last5: string | null, xg: number | null): TeamForm => ({
  last5, goals_for: null, goals_against: null, xg_for: xg, xg_against: null, clean_sheet_rate: null, btts_rate: null, euro_fatigue_days: null,
});

function averageGoals(matches: MatchData["h2h"]["matches"]): number | null {
  if (matches.length === 0) return null;
  const total = matches.reduce((sum, match) => sum + match.home_score + match.away_score, 0);
  return Math.round((total / matches.length) * 10) / 10;
}

export function matchDataFromContract(detail: ContractDetail, extras: FrozenExtras): MatchData {
  return {
    contract_version: detail.contract_version,
    match: {
      id: detail.match.id,
      kickoff_utc: detail.match.kickoff_utc,
      league: { id: detail.match.league.id, name: extras.league_name, round: extras.round ?? detail.match.league.round },
      referee: extras.referee ?? detail.match.referee,
      venue: extras.venue,
    },
    teams: extras.teams,
    model: detail.model,
    outcome: detail.outcome,
    outcome_double: null,
    comfortable_win: { home: null, away: null },
    score_distribution: detail.score_distribution,
    score_scene_allowed: detail.score_scene_allowed,
    goals: { two_plus: null, three_plus: detail.goals.three_plus, four_plus: null, five_plus: null, distribution: null },
    both_score: detail.both_score,
    team_goal_chance: null,
    team_two_plus: { home: null, away: null },
    clean_win: { home: null, away: null },
    first_half: { home: null, draw: null, away: null, any_goal: null, two_plus: null },
    half_most_goals: null,
    comeback: { home: null, away: null },
    first_goal: detail.first_goal,
    corners: { more: null, nine_plus: null, ten_plus: null, eleven_plus: null },
    cards: { four_plus: null, five_plus: null, six_plus: null, red_card: null },
    penalty: null,
    scorer_chances: [],
    players: extras.players,
    context: extras.context,
    analyst_screen_note: null,
    analyst_voice_note: null,
    lineup_edits: null,
    // Aynı videoda iki farklı xG görünmesin: takım kartı sezon xG'si gösteriyorsa soru sahneleri de onu kullanır.
    form: {
      home: blankForm(detail.form.home, extras.context?.teams.home.xg_for_avg ?? detail.recent_xg.home),
      away: blankForm(detail.form.away, extras.context?.teams.away.xg_for_avg ?? detail.recent_xg.away),
    },
    h2h: {
      played: detail.h2h.played,
      home_wins: detail.h2h.home_wins,
      draws: detail.h2h.draws,
      away_wins: detail.h2h.away_wins,
      avg_goals: averageGoals(extras.h2h_matches),
      matches: extras.h2h_matches,
    },
    model_track_record: null,
  };
}
