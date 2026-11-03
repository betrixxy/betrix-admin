import type { MatchData, Side } from "./match-data";

/**
 * Tutarlılık denetimleri (saf). Aynı olayın çelişen iki değeri videoya girmez: şüpheli alan bulunursa ilgili sahne kapanır
 * ve neden panele yazılır. Eşikler gerçek veride görülen çelişkilere göre (`KESIF_RAPORU.md`):
 * 4+ gol 0,43 ↔ 0,19; kart 3,5 = 4,5; gol yemeden kazanma toplamı > iki takım da gol bulamama.
 */

export const SUM_TOLERANCE = 0.015;
/** Aynı olayın iki kaynaktaki değeri arasında kabul edilen fark. */
export const SAME_EVENT_TOLERANCE = 0.02;
/** Kart basamakları arasında beklenen en küçük fark: eşit ya da neredeyse eşit basamak şüphelidir. */
export const MIN_CARD_STEP = 0.02;
/** Gol başına düşen olasılıkta bu kadar çukur "dağılım şekli bozuk" sayılır. */
export const DIP_TOLERANCE = 0.02;

const inRange = (value: number): boolean => value >= 0 && value <= 1;
const close = (a: number, b: number, tolerance = SUM_TOLERANCE): boolean => Math.abs(a - b) <= tolerance;
const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

export function checkOutcome(outcome: MatchData["outcome"]): string | null {
  return close(total([outcome.home_win, outcome.draw, outcome.away_win]), 1) ? null : "Maç sonucu olasılıkları toplamı 1 değil";
}

export function checkDouble(data: Pick<MatchData, "outcome" | "outcome_double">): string | null {
  if (!data.outcome_double) return "Puan senaryosu verisi yok";
  const { home_or_draw: homeOrDraw, draw_or_away: drawOrAway } = data.outcome_double;
  if (!close(homeOrDraw, data.outcome.home_win + data.outcome.draw) || !close(drawOrAway, data.outcome.draw + data.outcome.away_win)) return "Puan senaryosu maç sonucuyla çelişiyor";
  return null;
}

export const winOf = (data: Pick<MatchData, "outcome">, side: Side): number => (side === "home" ? data.outcome.home_win : data.outcome.away_win);

export function checkComfort(data: Pick<MatchData, "outcome" | "comfortable_win">, side: Side): string | null {
  const value = data.comfortable_win[side];
  if (value === null) return "2+ farklı galibiyet verisi yok";
  return value <= winOf(data, side) + SUM_TOLERANCE ? null : "2+ farklı galibiyet, galibiyetin kendisini aşıyor";
}

export type Ladder = { two_plus: number; three_plus: number; four_plus: number; five_plus: number };

export const ladderOf = (goals: MatchData["goals"]): Ladder | null =>
  goals.two_plus === null || goals.three_plus === null || goals.four_plus === null || goals.five_plus === null
    ? null
    : { two_plus: goals.two_plus, three_plus: goals.three_plus, four_plus: goals.four_plus, five_plus: goals.five_plus };

/** Merdivenden çubuklar: 0–1, 2, 3, 4, 5+. Aynı kaynaktan olduğu için merdivenle çelişemez. */
export const barsFromLadder = (ladder: Ladder): number[] => [
  1 - ladder.two_plus,
  ladder.two_plus - ladder.three_plus,
  ladder.three_plus - ladder.four_plus,
  ladder.four_plus - ladder.five_plus,
  ladder.five_plus,
];

/** Gol başına olasılıkta iki yanından belirgin düşük basamak var mı. 5+ kuyruk olduğu için bakılmaz, 0–1 iki gole bölünür. */
export function hasDip(bars: readonly number[]): boolean {
  const [low = 0, two = 0, three = 0, four = 0] = bars;
  const perGoal = [low / 2, two, three, four];
  return perGoal.some((value, index) => {
    const before = perGoal[index - 1];
    const after = perGoal[index + 1];
    return before !== undefined && after !== undefined && value < before - DIP_TOLERANCE && value < after - DIP_TOLERANCE;
  });
}

/** Gollü maç sahnesi: merdiven azalan, simülasyon dağılımı varsa merdivenle aynı, şekil bozuk değil. */
export function checkGoals(goals: MatchData["goals"]): string | null {
  const ladder = ladderOf(goals);
  if (!ladder) return "Gol merdiveni eksik";
  const steps = [ladder.two_plus, ladder.three_plus, ladder.four_plus, ladder.five_plus];
  if (!steps.every(inRange)) return "Gol merdiveni aralık dışında";
  if (steps.some((value, index) => index > 0 && value >= (steps[index - 1] ?? 1))) return "Gol merdiveni azalmıyor";
  if (goals.distribution) {
    const dist = goals.distribution;
    if (dist.length !== 6 || !close(total(dist), 1)) return "Toplam gol dağılımı bozuk";
    const tail = (from: number) => total(dist.slice(from));
    const pairs: [number, number][] = [[ladder.two_plus, tail(2)], [ladder.three_plus, tail(3)], [ladder.four_plus, tail(4)], [ladder.five_plus, tail(5)]];
    if (pairs.some(([a, b]) => !close(a, b, SAME_EVENT_TOLERANCE))) return "Gol merdiveni ile toplam gol dağılımı çelişiyor";
    return null;
  }
  return hasDip(barsFromLadder(ladder)) ? "Gol merdiveninden çıkan dağılımın şekli bozuk" : null;
}

export function checkBothScore(data: Pick<MatchData, "both_score" | "team_goal_chance">): string | null {
  if (data.both_score === null) return "İki takım da gol verisi yok";
  if (!inRange(data.both_score)) return "İki takım da gol verisi aralık dışında";
  const chance = data.team_goal_chance;
  if (chance && data.both_score > Math.min(chance.home, chance.away) + SUM_TOLERANCE) return "İki takım da gol, tek takımın gol olasılığını aşıyor";
  return null;
}

export function checkTeamTwoPlus(data: Pick<MatchData, "team_two_plus" | "goals">, side: Side): string | null {
  const value = data.team_two_plus[side];
  if (value === null) return "Takım golü verisi yok";
  if (data.goals.two_plus !== null && value > data.goals.two_plus + SUM_TOLERANCE) return "Takım golü, maçın toplam golüyle çelişiyor";
  return null;
}

/** Gol yemeden kazanan maçta iki takım birden gol bulamaz: iki değerin toplamı "iki takım da gol bulamaz"ı aşamaz. */
export function checkCleanWin(data: Pick<MatchData, "outcome" | "clean_win" | "both_score">, side: Side): string | null {
  const value = data.clean_win[side];
  if (value === null) return "Gol yemeden kazanma verisi yok";
  if (value > winOf(data, side) + SUM_TOLERANCE) return "Gol yemeden kazanma, galibiyeti aşıyor";
  const other = data.clean_win[side === "home" ? "away" : "home"] ?? 0;
  if (data.both_score !== null && value + other > 1 - data.both_score + SUM_TOLERANCE) return "Gol yemeden kazanma, iki takım da gol değeriyle çelişiyor";
  return null;
}

export function checkFirstHalfResult(half: MatchData["first_half"]): string | null {
  if (half.home === null || half.draw === null || half.away === null) return "İlk yarı sonucu eksik";
  return close(half.home + half.draw + half.away, 1) ? null : "İlk yarı olasılıkları toplamı 1 değil";
}

export function checkFirstHalfGoal(half: MatchData["first_half"]): string | null {
  if (half.any_goal === null) return "İlk yarı gol verisi yok";
  if (half.home !== null && half.away !== null && half.any_goal < half.home + half.away - SUM_TOLERANCE) return "İlk yarı gol değeri, ilk yarı sonucuyla çelişiyor";
  if (half.two_plus !== null && half.two_plus > half.any_goal) return "İlk yarı gol basamakları çelişiyor";
  return null;
}

export function checkHalves(halves: MatchData["half_most_goals"]): string | null {
  if (!halves) return "En golcü yarı verisi yok";
  return close(halves.first + halves.second + halves.equal, 1) ? null : "En golcü yarı olasılıkları toplamı 1 değil";
}

export function checkComeback(data: Pick<MatchData, "comeback" | "outcome" | "first_half">): string | null {
  const { home, away } = data.comeback;
  if (home === null || away === null) return "Geriden gelme verisi yok";
  if (home > data.outcome.home_win + SUM_TOLERANCE || away > data.outcome.away_win + SUM_TOLERANCE) return "Geriden gelme, galibiyeti aşıyor";
  const half = data.first_half;
  if ((half.away !== null && home > half.away + SUM_TOLERANCE) || (half.home !== null && away > half.home + SUM_TOLERANCE)) return "Geriden gelme, ilk yarı sonucuyla çelişiyor";
  return null;
}

export function checkFirstGoal(first: MatchData["first_goal"]): string | null {
  if (first.home === null || first.away === null || first.none === null) return "İlk gol verisi eksik";
  return close(first.home + first.away + first.none, 1) ? null : "İlk gol olasılıkları toplamı 1 değil";
}

export function checkCorners(corners: MatchData["corners"]): string | null {
  if (!corners.more) return "Korner verisi yok";
  if (!close(corners.more.home + corners.more.away + corners.more.equal, 1)) return "Korner olasılıkları toplamı 1 değil";
  const steps = [corners.nine_plus, corners.ten_plus, corners.eleven_plus].filter((value): value is number => value !== null);
  return steps.some((value, index) => index > 0 && value >= (steps[index - 1] ?? 1)) ? "Korner basamakları azalmıyor" : null;
}

/** Bilinen şüphe: 3,5 ve 4,5 kart değerlerinin eşit gelmesi. Azalmayan ya da neredeyse aynı basamak sahneyi kapatır. */
export function checkCards(cards: MatchData["cards"]): string | null {
  if (cards.four_plus === null || cards.five_plus === null || cards.six_plus === null) return "Kart basamakları eksik";
  const steps = [cards.four_plus, cards.five_plus, cards.six_plus];
  if (steps.some((value, index) => index > 0 && (steps[index - 1] ?? 1) - value < MIN_CARD_STEP)) return "Kart değerleri şüpheli: basamaklar eşit ya da neredeyse eşit";
  if (cards.red_card !== null && !inRange(cards.red_card)) return "Kırmızı kart değeri aralık dışında";
  return null;
}

export function checkPenalty(penalty: number | null): string | null {
  if (penalty === null) return "Penaltı verisi yok";
  return inRange(penalty) ? null : "Penaltı değeri aralık dışında";
}
