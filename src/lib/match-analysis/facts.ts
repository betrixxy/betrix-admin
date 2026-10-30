import { formatNumber } from "@/lib/format/number";
import { isFirstHalf, isScoring, isSendingOff, matchMinute } from "@/lib/match-analysis/moments";
import type { AnalysisEvent, AnalysisFact, AnalysisFactKind, HalfRow, HalfStatKey, HalvesOutcome, SidePair } from "@/types/match-analysis";
import type { MatchOutcome, MatchSide } from "@/types/match-result";

/**
 * 02'nin altındaki OLGULAR — kural tabanlı, deterministik (saf). Yorum ve sıfat yok ("harika", "baskılı" yok);
 * her cümle veriden doğrudan doğrulanır. Sayılar ortak biçimden (ondalık virgül). Sayıya ek getirmeyen cümle
 * kalıpları seçildi ("2 golünü de", "(2 → 7)") — Türkçe ünlü uyumu hatası olmasın. Takım adı kart adıdır
 * (büyütülmemiş: "Galatasaray"). Öncelik `FACT_PRIORITY` sırasıdır; her kuraldan en fazla bir olgu, önce ev
 * sahibi; en fazla `MAX_FACTS`. Devre satırına bağlı kurallar yalnızca 02 varken (aynı tek kaynaktan) çalışır.
 */

export const MAX_FACTS = 3;
/** "İlk 15 dakika" kuralı. */
export const EARLY_MINUTES = 15;
/** Son dakika kuralı: sonucu belirleyen son değişim bu dakikadan sonra. */
export const LATE_MINUTE = 80;

export interface FactInput {
  events: readonly AnalysisEvent[];
  halftime: SidePair;
  final: SidePair;
  outcome: MatchOutcome;
  /** Kart adları: { HOME: "Konyaspor", AWAY: "Galatasaray" }. */
  names: Record<MatchSide, string>;
  halves: HalvesOutcome;
  /** Skor olaylarla tutmuyorsa olaya dayalı kurallar çalışmaz. */
  scoreConsistent: boolean;
}

type Rule = (input: FactInput) => string | null;
const SIDES: readonly MatchSide[] = ["HOME", "AWAY"];
const other = (side: MatchSide): MatchSide => (side === "HOME" ? "AWAY" : "HOME");
const pick = (pair: SidePair, side: MatchSide) => (side === "HOME" ? pair.home : pair.away);
const goals = (input: FactInput) => input.events.filter(isScoring);
const row = (input: FactInput, key: HalfStatKey): HalfRow | null => (input.halves.available ? (input.halves.stats.rows.find((r) => r.key === key) ?? null) : null);
/** "88. dakikada", "90+3. dakikada" */
const minutePhrase = (event: AnalysisEvent) => `${event.extra ? `${event.elapsed}+${event.extra}` : event.elapsed}. dakikada`;
const firstOf = (fn: (side: MatchSide) => string | null) => SIDES.map(fn).find((text) => text !== null) ?? null;
const sign = (diff: number) => (diff > 0 ? 1 : diff < 0 ? -1 : 0);

const redThenConceded: Rule = (input) =>
  firstOf((side) => {
    const red = input.events.findIndex((event) => event.side === side && isSendingOff(event));
    if (red < 0) return null;
    const conceded = input.events.slice(red + 1).filter((event) => isScoring(event) && event.side === other(side)).length;
    return conceded > 0 ? `${input.names[side]} 10 kişi kaldıktan sonra ${conceded} gol yedi.` : null;
  });

const redThenScored: Rule = (input) =>
  firstOf((side) => {
    const red = input.events.findIndex((event) => event.side === side && isSendingOff(event));
    if (red < 0) return null;
    const scored = input.events.slice(red + 1).filter((event) => isScoring(event) && event.side === side).length;
    return scored > 0 ? `${input.names[side]} 10 kişiyken ${scored} gol buldu.` : null;
  });

/** Geriye düştüğü maçı kazanan / eşitleyen taraf. */
const comeback: Rule = (input) => {
  const trailed: Record<MatchSide, boolean> = { HOME: false, AWAY: false };
  for (const goal of goals(input)) {
    if (!goal.score) continue;
    if (goal.score.home < goal.score.away) trailed.HOME = true;
    if (goal.score.away < goal.score.home) trailed.AWAY = true;
  }
  if (input.outcome === "DRAW") {
    const last = goals(input).at(-1);
    return last && trailed[last.side] && input.final.home === input.final.away ? `${input.names[last.side]} geriye düştüğü maçta skoru eşitledi.` : null;
  }
  const winner = input.outcome;
  if (!trailed[winner]) return null;
  const htBehind = pick(input.halftime, winner) < pick(input.halftime, other(winner));
  return htBehind ? `İlk yarıyı geride kapatan ${input.names[winner]} maçı kazandı.` : `${input.names[winner]} geriye düştüğü maçı kazandı.`;
};

/** Sonucu belirleyen son değişim (öne geçme / eşitlik) `LATE_MINUTE` sonrasında. */
const lateDecider: Rule = (input) => {
  let last: AnalysisEvent | null = null;
  let state = 0;
  for (const goal of goals(input)) {
    if (!goal.score) continue;
    const next = sign(goal.score.home - goal.score.away);
    if (next !== state) last = goal;
    state = next;
  }
  if (!last?.score || matchMinute(last) < LATE_MINUTE) return null;
  return last.score.home === last.score.away ? `${input.names[last.side]} ${minutePhrase(last)} skoru eşitledi.` : `${input.names[last.side]} ${minutePhrase(last)} öne geçti.`;
};

const shotsMultiplied: Rule = (input) => {
  const shots = row(input, "shotsTotal");
  if (!shots) return null;
  return firstOf((side) => {
    const [a, b] = [pick(shots.first, side), pick(shots.second, side)];
    if (a < 1 || b < 3 * a || b < 6) return null;
    const times = Math.floor(b / a);
    const how = b === times * a ? `${times} katına` : `${times} katından fazlasına`;
    return `${input.names[side]} ikinci yarıda şut sayısını ${how} çıkardı (${a} → ${b}).`;
  });
};

const noShotsFirstHalf: Rule = (input) => {
  const shots = row(input, "shotsTotal");
  if (!shots) return null;
  return firstOf((side) => (pick(shots.first, side) === 0 && pick(shots.second, side) >= 3 ? `${input.names[side]} ilk yarıda şut çekemedi, ikinci yarıda ${pick(shots.second, side)} şut çekti.` : null));
};

const noShotOnTargetHalf: Rule = (input) => {
  const onTarget = row(input, "shotsOnTarget");
  if (!onTarget) return null;
  return firstOf((side) => {
    const [a, b] = [pick(onTarget.first, side), pick(onTarget.second, side)];
    if (a === 0 && b === 0) return `${input.names[side]} maç boyunca isabetli şut çekemedi.`;
    if (b === 0) return `${input.names[side]} ikinci yarıda isabetli şut çekemedi.`;
    return a === 0 ? `${input.names[side]} ilk yarıda isabetli şut çekemedi.` : null;
  });
};

const earlyGoals: Rule = (input) => {
  const all = goals(input);
  const early = (list: AnalysisEvent[]) => list.length >= 2 && list.every((goal) => matchMinute(goal) <= EARLY_MINUTES);
  if (early(all)) return `Maçtaki ${all.length} golün hepsi ilk ${EARLY_MINUTES} dakikada geldi.`;
  return firstOf((side) => {
    const own = all.filter((goal) => goal.side === side);
    return early(own) ? `${input.names[side]} ${own.length} golünü de ilk ${EARLY_MINUTES} dakikada buldu.` : null;
  });
};

const oneHalfGoals: Rule = (input) => {
  const all = goals(input);
  if (all.length < 2 || all.some((goal) => goal.elapsed > 90)) return null;
  if (all.every(isFirstHalf)) return `Maçtaki ${all.length} golün hepsi ilk yarıda geldi.`;
  return all.every((goal) => !isFirstHalf(goal)) ? `Maçtaki ${all.length} golün hepsi ikinci yarıda geldi.` : null;
};

const possessionSwing: Rule = (input) => {
  const possession = row(input, "possession");
  if (!possession) return null;
  return firstOf((side) => {
    const [a, b] = [pick(possession.first, side), pick(possession.second, side)];
    const gain = b - a;
    return gain >= 10 ? `${input.names[side]} ikinci yarıda topa sahip olmada ${formatNumber(gain, { maxDecimals: 1 })} puan artış yakaladı (%${formatNumber(a, { maxDecimals: 1 })} → %${formatNumber(b, { maxDecimals: 1 })}).` : null;
  });
};

const xgSwing: Rule = (input) => {
  const xg = row(input, "xg");
  if (!xg) return null;
  return firstOf((side) => {
    const [a, b] = [pick(xg.first, side), pick(xg.second, side)];
    return a > 0 && b >= 1 && b >= 2 * a ? `${input.names[side]} ikinci yarıda ${formatNumber(b, { decimals: 2 })} xG üretti (ilk yarı ${formatNumber(a, { decimals: 2 })}).` : null;
  });
};

const shotsBothHalves: Rule = (input) => {
  const shots = row(input, "shotsTotal");
  if (!shots) return null;
  return firstOf((side) => {
    const mine = [pick(shots.first, side), pick(shots.second, side)] as const;
    const theirs = [pick(shots.first, other(side)), pick(shots.second, other(side))] as const;
    return mine[0] > theirs[0] && mine[1] > theirs[1] ? `${input.names[side]} iki yarıda da rakibinden çok şut çekti: ilk yarı ${mine[0]}, ikinci yarı ${mine[1]}.` : null;
  });
};

const halfScores: Rule = (input) => {
  if (goals(input).some((goal) => goal.elapsed > 90)) return null;
  const second = { home: input.final.home - input.halftime.home, away: input.final.away - input.halftime.away };
  return `Yarı skorları: ilk yarı ${input.halftime.home}-${input.halftime.away}, ikinci yarı ${second.home}-${second.away}.`;
};

/** Olaya dayalı kurallar skor tutarlılığı ister. */
const EVENT_RULES = new Set<AnalysisFactKind>(["RED_THEN_CONCEDED", "RED_THEN_SCORED", "COMEBACK", "LATE_DECIDER", "EARLY_GOALS", "ONE_HALF_GOALS", "HALF_SCORES"]);

export const FACT_PRIORITY: readonly [AnalysisFactKind, Rule][] = [
  ["RED_THEN_CONCEDED", redThenConceded],
  ["RED_THEN_SCORED", redThenScored],
  ["COMEBACK", comeback],
  ["LATE_DECIDER", lateDecider],
  ["SHOTS_MULTIPLIED", shotsMultiplied],
  ["NO_SHOTS_FIRST_HALF", noShotsFirstHalf],
  ["NO_SHOT_ON_TARGET_HALF", noShotOnTargetHalf],
  ["EARLY_GOALS", earlyGoals],
  ["ONE_HALF_GOALS", oneHalfGoals],
  ["POSSESSION_SWING", possessionSwing],
  ["XG_SWING", xgSwing],
  ["SHOTS_BOTH_HALVES", shotsBothHalves],
  ["HALF_SCORES", halfScores],
];

export function analysisFacts(input: FactInput): AnalysisFact[] {
  const facts: AnalysisFact[] = [];
  for (const [kind, rule] of FACT_PRIORITY) {
    if (facts.length >= MAX_FACTS) break;
    if (!input.scoreConsistent && EVENT_RULES.has(kind)) continue;
    const text = rule(input);
    if (text) facts.push({ kind, text });
  }
  return facts;
}
