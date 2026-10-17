import { upperTr } from "@/lib/dashboard/match-result-labels";
import { formatStatValue } from "@/lib/dashboard/match-stats-rows";
import type { MatchStatsFacts, StatRowKey } from "@/types/match-stats";

/**
 * Skorun altındaki "öne çıkan satır" — kurala dayalı, saf (LLM yok, bkz. CLAUDE.md 1.10). Kurallar
 * sırayla denenir, ilk tutan yazılır; hiçbiri tutmazsa satır yok. Her sayı maçın kendi verisidir.
 */

type Side = "home" | "away";
const other = (side: Side): Side => (side === "home" ? "away" : "home");

function valueOf(facts: MatchStatsFacts, key: StatRowKey, side: Side): number | null {
  const row = facts.rows.find((candidate) => candidate.key === key);
  return row ? row[side] : null;
}

const goalWord = (goals: number) => (goals === 0 ? "GOL YOK" : goals === 1 ? "TEK GOL" : `${goals} GOL`);

type Rule = (facts: MatchStatsFacts, side: Side) => string | null;

/** xG farkı ≥ 1,5 ama gol farkı ≤ 1: "28 ŞUT, 2,41 xG — TEK GOL". */
const xgUnderperformance: Rule = (facts, side) => {
  const [xg, rivalXg, shots] = [valueOf(facts, "xg", side), valueOf(facts, "xg", other(side)), valueOf(facts, "shotsTotal", side)];
  if (xg === null || rivalXg === null || xg - rivalXg < 1.5) return null;
  if (Math.abs(facts.home.goals - facts.away.goals) > 1) return null;
  const shotsPart = shots === null ? "" : `${shots} ŞUT, `;
  return `${shotsPart}${formatStatValue("xg", xg)} xG — ${goalWord(facts[side].goals)}`;
};

/** xG yokken şut üstünlüğü: ≥ 20 şut, rakibin ≥ 3 katı, gol farkı ≤ 1 → "28 ŞUT, 7 İSABET — TEK GOL". */
const shotDominance: Rule = (facts, side) => {
  const [shots, rivalShots, onTarget] = [valueOf(facts, "shotsTotal", side), valueOf(facts, "shotsTotal", other(side)), valueOf(facts, "shotsOnTarget", side)];
  if (shots === null || rivalShots === null || shots < 20 || shots < rivalShots * 3) return null;
  if (Math.abs(facts.home.goals - facts.away.goals) > 1) return null;
  const onTargetPart = onTarget === null ? "" : `, ${onTarget} İSABET`;
  return `${shots} ŞUT${onTargetPart} — ${goalWord(facts[side].goals)}`;
};

/** Düşük topla kazanma: kazananın top hakimiyeti ≤ %35. */
const lowPossessionWin: Rule = (facts, side) => {
  const winner = facts.outcome === "HOME" ? "home" : facts.outcome === "AWAY" ? "away" : null;
  if (winner !== side) return null;
  const possession = valueOf(facts, "possession", side);
  if (possession === null || possession > 35) return null;
  return `${formatStatValue("possession", possession)} TOPLA KAZANDI`;
};

/** Tek isabetli şut, tek gol (ve galibiyet ya da beraberlik). */
const clinical: Rule = (facts, side) => {
  const onTarget = valueOf(facts, "shotsOnTarget", side);
  if (onTarget !== 1 || facts[side].goals !== 1) return null;
  return "TEK İSABETLİ ŞUT, TEK GOL";
};

const RULES: Rule[] = [xgUnderperformance, shotDominance, lowPossessionWin, clinical];

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
