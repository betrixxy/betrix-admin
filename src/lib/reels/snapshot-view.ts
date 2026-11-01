import { formatIstanbulDate } from "@/lib/reels/publish-window";
import type { ReelsMatchDetail } from "@/lib/services/reels-schema";

/**
 * "Dondurulan veriler" kartının görünüm modeli: yalnız analist dili, tam sayı yüzde. Ham yanıtın alan adları
 * buradan öteye geçmez. Saf fonksiyonlar.
 */

/** 0,684 → "%68". Değer yoksa tire. */
export const reelPercent = (value: number | null): string => (value === null ? "–" : `%${Math.round(value * 100)}`);

/** Bar genişliği için 0–100 tam sayı. */
export const reelBarWidth = (value: number): number => Math.max(0, Math.min(100, Math.round(value * 100)));

export type ReelFormLetter = "G" | "B" | "M";

const FORM_LETTERS: Record<string, ReelFormLetter> = { W: "G", D: "B", L: "M" };

/** Servis dizesi en yeni maçla başlar; kutucuklar da en yeni solda. En fazla 5. */
export function reelFormBoxes(form: string | null): ReelFormLetter[] {
  return [...(form ?? "")].slice(0, 5).flatMap((letter) => {
    const mapped = FORM_LETTERS[letter];
    return mapped ? [mapped] : [];
  });
}

export interface ReelSnapshotView {
  homeName: string;
  awayName: string;
  outcome: { label: string; percent: string; width: number; tone: "home" | "draw" | "away" }[];
  highlights: { label: string; value: string }[];
  firstGoal: { label: string; value: string }[];
  form: { name: string; boxes: ReelFormLetter[] }[];
  h2h: { label: string; value: string }[] | null;
  scores: { label: string; percent: string }[] | null;
  leaders: { team: string; updated: string | null; players: { name: string; line: string }[] }[];
}

const stat = (value: number | null): string => (value === null ? "–" : String(value));

export function reelSnapshotView(detail: ReelsMatchDetail): ReelSnapshotView {
  const homeName = detail.teams.home.name;
  const awayName = detail.teams.away.name;
  const updated = detail.season_xg_leaders.data_updated_at;
  const leaderBlock = (team: string, players: ReelsMatchDetail["season_xg_leaders"]["home"], at: string | null) => ({
    team,
    updated: at ? formatIstanbulDate(new Date(at)) : null,
    players: players.map((player) => ({
      name: player.name,
      line: `${stat(player.season_goals)} gol · ${player.season_xg === null ? "–" : player.season_xg.toFixed(2)} xG · ${stat(player.season_games)} maç`,
    })),
  });

  return {
    homeName,
    awayName,
    outcome: [
      { label: homeName, percent: reelPercent(detail.outcome.home_win), width: reelBarWidth(detail.outcome.home_win), tone: "home" },
      { label: "Beraberlik", percent: reelPercent(detail.outcome.draw), width: reelBarWidth(detail.outcome.draw), tone: "draw" },
      { label: awayName, percent: reelPercent(detail.outcome.away_win), width: reelBarWidth(detail.outcome.away_win), tone: "away" },
    ],
    highlights: [
      { label: "3 ve üzeri gol olasılığı", value: reelPercent(detail.goals.three_plus) },
      { label: "İki takımın da gol bulma olasılığı", value: reelPercent(detail.both_score) },
    ],
    firstGoal: [
      { label: homeName, value: reelPercent(detail.first_goal.home) },
      { label: awayName, value: reelPercent(detail.first_goal.away) },
      { label: "Gol yok", value: reelPercent(detail.first_goal.none) },
    ],
    form: [
      { name: homeName, boxes: reelFormBoxes(detail.form.home) },
      { name: awayName, boxes: reelFormBoxes(detail.form.away) },
    ],
    h2h: detail.h2h.played === null ? null : [
      { label: "Oynanan", value: stat(detail.h2h.played) },
      { label: `${homeName} galibiyeti`, value: stat(detail.h2h.home_wins) },
      { label: "Beraberlik", value: stat(detail.h2h.draws) },
      { label: `${awayName} galibiyeti`, value: stat(detail.h2h.away_wins) },
    ],
    scores: detail.score_scene_allowed
      ? detail.score_distribution.slice(0, 5).map((cell) => ({ label: `${cell.home_goals}-${cell.away_goals}`, percent: reelPercent(cell.p) }))
      : null,
    leaders: [
      leaderBlock(homeName, detail.season_xg_leaders.home, updated.home),
      leaderBlock(awayName, detail.season_xg_leaders.away, updated.away),
    ].filter((block) => block.players.length > 0),
  };
}
