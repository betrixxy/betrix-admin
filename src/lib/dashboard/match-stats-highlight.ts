import { upperTr } from "@/lib/dashboard/match-result-labels";
import { formatStatValue } from "@/lib/dashboard/match-stats-rows";
import type { MatchStatsFacts, StatRowKey } from "@/types/match-stats";

/**
 * Skorun üstündeki "öne çıkan satır" — kurala dayalı, saf (LLM yok, bkz. CLAUDE.md 1.10). Yalnızca
 * olgu yazılır, yorum yok. Kurallar sırayla denenir (her kuralda önce ev sahibi), ilk tutan yazılır;
 * hiçbiri tutmazsa satır yok.
 *
 *   1. Harcanan fırsat:     gol ≤ xG − 1,5            → "19 ŞUT, 3,39 xG — 2 GOL"
 *   2. Etkili bitiricilik:  gol ≥ xG + 1,5            → "0,84 xG'DEN 3 GOL"
 *   3. Az topla galibiyet:  top hakimiyeti ≤ %40, kazandı → "%32 TOPLA 2-1"
 *   4. (xG yoksa) Şut üstünlüğü: ≥ 20 şut, rakibin ≥ 3 katı, gol ≤ 1 → "28 ŞUT, 7 İSABET — TEK GOL"
 */

type Side = "home" | "away";
const other = (side: Side): Side => (side === "home" ? "away" : "home");

/** xG ile gol arasındaki fark bu kadar olunca satıra değer. */
const XG_GAP = 1.5;
const LOW_POSSESSION = 40;
const SHOT_DOMINANCE_MIN = 20;
const SHOT_DOMINANCE_RATIO = 3;

function valueOf(facts: MatchStatsFacts, key: StatRowKey, side: Side): number | null {
  const row = facts.rows.find((candidate) => candidate.key === key);
  return row ? row[side] : null;
}

/** 0 → "GOL YOK", 1 → "TEK GOL", n → "n GOL". */
const goalWord = (goals: number) => (goals === 0 ? "GOL YOK" : goals === 1 ? "TEK GOL" : `${goals} GOL`);

type Rule = (facts: MatchStatsFacts, side: Side) => string | null;

const wastedChances: Rule = (facts, side) => {
  const xg = valueOf(facts, "xg", side);
  const goals = facts[side].goals;
  if (xg === null || goals > xg - XG_GAP) return null;
  const shots = valueOf(facts, "shotsTotal", side);
  return `${shots === null ? "" : `${shots} ŞUT, `}${formatStatValue("xg", xg)} xG — ${goalWord(goals)}`;
};

const clinicalFinishing: Rule = (facts, side) => {
  const xg = valueOf(facts, "xg", side);
  const goals = facts[side].goals;
  if (xg === null || goals < xg + XG_GAP) return null;
  return `${formatStatValue("xg", xg)} xG'DEN ${goals} GOL`;
};

const lowPossessionWin: Rule = (facts, side) => {
  const won = facts.outcome === (side === "home" ? "HOME" : "AWAY");
  const possession = valueOf(facts, "possession", side);
  if (!won || possession === null || possession > LOW_POSSESSION) return null;
  return `${formatStatValue("possession", possession)} TOPLA ${facts[side].goals}-${facts[other(side)].goals}`;
};

/** Yalnızca maçta hiç xG verisi yokken. */
const shotDominance: Rule = (facts, side) => {
  if (facts.rows.some((row) => row.key === "xg")) return null;
  const [shots, rivalShots, onTarget] = [valueOf(facts, "shotsTotal", side), valueOf(facts, "shotsTotal", other(side)), valueOf(facts, "shotsOnTarget", side)];
  if (shots === null || rivalShots === null || shots < SHOT_DOMINANCE_MIN || shots < rivalShots * SHOT_DOMINANCE_RATIO) return null;
  if (facts[side].goals > 1) return null;
  return `${shots} ŞUT${onTarget === null ? "" : `, ${onTarget} İSABET`} — ${goalWord(facts[side].goals)}`;
};

const RULES: Rule[] = [wastedChances, clinicalFinishing, lowPossessionWin, shotDominance];

/** "BEŞİKTAŞ · 28 ŞUT, 7 İSABET — TEK GOL"; kural tutmazsa null. */
export function statsHighlight(facts: MatchStatsFacts): string | null {
  for (const rule of RULES) {
    for (const side of ["home", "away"] as const) {
      const text = rule(facts, side);
      if (text) return `${upperTr(facts[side].name)} · ${text}`;
    }
  }
  return null;
}
