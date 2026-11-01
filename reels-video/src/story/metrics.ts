import { formatDecimal } from "../lib/motion";
import type { CompareRow } from "../schema";
import type { MatchData, TeamForm } from "./match-data";

/** Karşılaştırma metrikleri: tablo, üstün taraf ve kilit fark aynı listeden çıkar. Saf. */

export interface Metric {
  key: string;
  /** Tablo etiketi. */
  label: string;
  /** "Kilit fark" başlığının 2. satırı. */
  headline: string;
  home: number;
  away: number;
  /** Düşük değer iyi mi. */
  lowerIsBetter: boolean;
  /** Bu metrikte anlamlı sayılan fark. Farklı ölçekteki metrikleri karşılaştırır. */
  spread: number;
  format: (value: number) => string;
  /** "{takım} {cümle}": kilit fark açıklaması. */
  sentence: (leader: string, leaderValue: string, other: string, otherValue: string) => string;
}

const dec = (value: number): string => formatDecimal(value);
const pct = (value: number): string => `%${Math.round(value * 100)}`;

type Field = "goals_for" | "goals_against" | "xg_for" | "xg_against" | "clean_sheet_rate";

const DEFINITIONS: ReadonlyArray<Omit<Metric, "home" | "away"> & { field: Field }> = [
  { field: "goals_for", key: "goals_for", label: "Attığı gol ort.", headline: "atılan gol", lowerIsBetter: false, spread: 0.5, format: dec, sentence: (a, av, b, bv) => `${a} maç başına ${av} gol atıyor, ${b} ${bv}.` },
  { field: "goals_against", key: "goals_against", label: "Yediği gol ort.", headline: "savunma", lowerIsBetter: true, spread: 0.5, format: dec, sentence: (a, av, b, bv) => `${a} maç başına ${av} gol yiyor, ${b} ${bv}.` },
  { field: "xg_for", key: "xg_for", label: "xG lehine", headline: "pozisyon üretimi", lowerIsBetter: false, spread: 0.5, format: dec, sentence: (a, av, b, bv) => `${a} maç başına ${av} xG üretiyor, ${b} ${bv}.` },
  { field: "xg_against", key: "xg_against", label: "xG aleyhine", headline: "verilen pozisyon", lowerIsBetter: true, spread: 0.5, format: dec, sentence: (a, av, b, bv) => `${a} maç başına ${av} xG veriyor, ${b} ${bv}.` },
  { field: "clean_sheet_rate", key: "clean_sheet", label: "Gol yememe oranı", headline: "kalesini kapatma", lowerIsBetter: false, spread: 0.25, format: pct, sentence: (a, av, b, bv) => `${a} maçların ${av} kadarında gol yemiyor, ${b} ${bv}.` },
];

/** İki takımda da değeri olan metrikler; eksik veri yazılmaz. */
export function compareMetrics(form: { home: TeamForm; away: TeamForm }): Metric[] {
  return DEFINITIONS.flatMap(({ field, ...definition }) => {
    const home = form.home[field];
    const away = form.away[field];
    return home === null || away === null ? [] : [{ ...definition, home, away }];
  });
}

export function betterSide(metric: Pick<Metric, "home" | "away" | "lowerIsBetter">): "home" | "away" | null {
  if (metric.home === metric.away) return null;
  return metric.home > metric.away !== metric.lowerIsBetter ? "home" : "away";
}

export const compareRows = (metrics: readonly Metric[]): CompareRow[] =>
  metrics.map((metric) => ({ key: metric.key, label: metric.label, home: metric.format(metric.home), away: metric.format(metric.away), better: betterSide(metric) }));

/** Metriğe özgü ölçekte fark: %30–%20 (10 maçta 1 maç) ile 2,6–0,9 gol aynı kefeye konmaz. */
export const gapScore = (metric: Pick<Metric, "home" | "away" | "spread">): number => Math.abs(metric.home - metric.away) / metric.spread;

/** Bunun altındaki fark "kilit" diye sunulmaz. */
export const MIN_KEY_GAP = 0.3;

/** Kilit fark: en açık metrik. Eşitlikte listedeki sıra kazanır; belirgin fark yoksa null. */
export function pickKeyGap(metrics: readonly Metric[]): Metric | null {
  return metrics.filter((metric) => betterSide(metric) !== null && gapScore(metric) >= MIN_KEY_GAP).reduce<Metric | null>((best, metric) => (best === null || gapScore(metric) > gapScore(best) ? metric : best), null);
}

const LETTERS: Record<string, "G" | "B" | "M"> = { W: "G", D: "B", L: "M" };

/** "WDL" → G/B/M, en yeni solda, en fazla 5. */
export const formLetters = (last5: string | null): ("G" | "B" | "M")[] =>
  [...(last5 ?? "")].slice(0, 5).flatMap((letter) => {
    const mapped = LETTERS[letter];
    return mapped ? [mapped] : [];
  });

/** Avrupa'da oynamayan takım: veride 99 ya da üstü. */
export const NO_EUROPE_DAYS = 99;
export const effectiveFatigue = (days: number | null): number | null => (days === null || days >= NO_EUROPE_DAYS ? null : Math.round(days));

export type OutcomeSide = "home" | "draw" | "away";

export function outcomeLeader(outcome: MatchData["outcome"]): OutcomeSide {
  const entries: [OutcomeSide, number][] = [["home", outcome.home_win], ["draw", outcome.draw], ["away", outcome.away_win]];
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}
