import { SCORING_KINDS, SENDING_OFF_KINDS, type AnalysisEvent, type BreakMoment, type BreakMomentKind, type SidePair } from "@/types/match-analysis";
import type { MatchSide } from "@/types/match-result";

/**
 * Akan skor + KIRILMA ANI (saf, deterministik). Olaylar sıralı gelir (`sortEvents`). Kurucu kararı 2026-10-30:
 *
 * Öncelik (yüksekten düşüğe; bir olay yalnızca EN YÜKSEK etiketini alır):
 *  1. KAZANDIRAN GOL (`DECISIVE_GOAL`) — galibi belirleyen gol: kazananı olan maçta, kazanana bir daha hiç
 *     kaybetmediği üstünlüğü veren gol (kazananın skoru rakibe eşit ya da gerideyken öne geçirdiği SON gol).
 *     Maç başına en fazla bir; beraberlikte yok (penaltı atışları gol sayılmaz). Kendi kalesine gol, golün
 *     yazıldığı (kazanan) tarafa sayılır.
 *  2. KIRMIZI + GOL (`RED_THEN_GOAL`) — sonrasında gol gelen kırmızı kart: kırmızı kart ya da ikinci sarıdan
 *     SONRA, maçın geri kalanında, sayıca üstün takım (kartı görmeyen taraf) gol attı ve gol anında kart gören
 *     taraf hâlâ eksikti (rakibi de eşit sayıda oyuncu kaybettiyse üstünlük bitmiştir). Vurgulanan olay KARTIN
 *     kendisidir; gol kendi etiketini ayrıca alabilir.
 *  3. EŞİTLEYEN GOL (`EQUALISER`) — geriden gelip eşitleyen gol: gerideki takımın skoru eşitleyen golü.
 *  4. İLK GOL (`FIRST_GOAL`) — maçın ilk golü (0-0 bozuldu).
 * Farkı açan ya da azaltan diğer goller, sarı kart, değişiklik, VAR ve kaçan penaltı kırılma anı değildir.
 * Kartta EN FAZLA 2 an vurgulanır (`MAX_BREAK_MOMENTS`): önce önceliğe, eşitlikte dakikaya göre seçilir;
 * seçilmeyen adayların etiketi yazılmaz (kart, gönderi metni ve offline araç aynı alanı okur).
 */

export const MAX_BREAK_MOMENTS = 2;
/** Kart çipi (≤ 16 karakter, Anton/Inter büyük harf güvenli, bahis dili kapısından geçer). */
export const BREAK_LABELS = { DECISIVE_GOAL: "KAZANDIRAN GOL", RED_THEN_GOAL: "KIRMIZI + GOL", EQUALISER: "EŞİTLEYEN GOL", FIRST_GOAL: "İLK GOL" } as const;
/** Öncelik sırası (dizin küçük = öncelikli). */
export const BREAK_PRIORITY: readonly BreakMomentKind[] = ["DECISIVE_GOAL", "RED_THEN_GOAL", "EQUALISER", "FIRST_GOAL"];
/** Gönderi metnindeki uzun söyleyiş. */
export const BREAK_CAPTIONS: Record<BreakMomentKind, string> = {
  DECISIVE_GOAL: "kazandıran gol",
  RED_THEN_GOAL: "kırmızı kart — sonrasında gol geldi",
  EQUALISER: "eşitleyen gol",
  FIRST_GOAL: "ilk gol",
};

const other = (side: MatchSide): MatchSide => (side === "HOME" ? "AWAY" : "HOME");
export const isScoring = (event: Pick<AnalysisEvent, "kind">) => SCORING_KINDS.includes(event.kind);
export const isSendingOff = (event: Pick<AnalysisEvent, "kind">) => SENDING_OFF_KINDS.includes(event.kind);
/** Uzatma dakikası dahil yaklaşık maç dakikası (pencere hesabı için). */
export const matchMinute = (event: Pick<AnalysisEvent, "elapsed" | "extra">) => event.elapsed + (event.extra ?? 0);
/** İlk yarı olayı mı: 45 ve 45+ dahil. */
export const isFirstHalf = (event: Pick<AnalysisEvent, "elapsed">) => event.elapsed <= 45;

const lead = (score: SidePair, side: MatchSide) => (side === "HOME" ? score.home - score.away : score.away - score.home);

/** Olaylara akan skoru yazar (golde golden sonraki skor). */
function withScores(events: readonly AnalysisEvent[]): { events: AnalysisEvent[]; final: SidePair; halftime: SidePair } {
  const score: SidePair = { home: 0, away: 0 };
  const halftime: SidePair = { home: 0, away: 0 };
  const out = events.map((event): AnalysisEvent => {
    if (!isScoring(event)) return { ...event, score: null, breakMoment: null };
    if (event.side === "HOME") score.home += 1;
    else score.away += 1;
    if (isFirstHalf(event)) {
      if (event.side === "HOME") halftime.home += 1;
      else halftime.away += 1;
    }
    return { ...event, score: { ...score }, breakMoment: null };
  });
  return { events: out, final: { ...score }, halftime };
}

/** Saf: her olayın aday etiketi (en yüksek öncelikli) — seçimden önce. */
export function breakCandidates(events: readonly AnalysisEvent[], final: SidePair): (BreakMomentKind | null)[] {
  const winner: MatchSide | null = final.home === final.away ? null : final.home > final.away ? "HOME" : "AWAY";
  // Kazandıran gol: kazananın eşit/geride iken öne geçtiği SON gol.
  let decisive = -1;
  let before: SidePair = { home: 0, away: 0 };
  events.forEach((event, index) => {
    if (!event.score) return;
    if (winner && event.side === winner && lead(before, winner) <= 0 && lead(event.score, winner) > 0) decisive = index;
    before = event.score;
  });
  // Kırmızı, sonra gol: kart anındaki eksik sayısı; sonraki golde kartı gören taraf hâlâ eksikse.
  const sentOff: Record<MatchSide, number> = { HOME: 0, AWAY: 0 };
  const redThenGoal = new Set<number>();
  const openReds: { index: number; side: MatchSide }[] = [];
  before = { home: 0, away: 0 };
  return events.map((event, index) => {
    if (isSendingOff(event)) {
      sentOff[event.side] += 1;
      openReds.push({ index, side: event.side });
      return null;
    }
    if (!event.score) return null;
    const previous = before;
    before = event.score;
    for (const red of openReds) if (event.side === other(red.side) && sentOff[red.side] > sentOff[event.side]) redThenGoal.add(red.index);
    if (index === decisive) return "DECISIVE_GOAL";
    if (event.score.home === event.score.away) return "EQUALISER";
    if (previous.home === 0 && previous.away === 0) return "FIRST_GOAL";
    return null;
  }).map((kind, index) => (redThenGoal.has(index) ? "RED_THEN_GOAL" : kind));
}

/** Saf: adaylardan en fazla `MAX_BREAK_MOMENTS` an — öncelik, sonra dakika (olay sırası). */
export function pickBreakMoments(candidates: readonly (BreakMomentKind | null)[]): Set<number> {
  const ranked = candidates
    .flatMap((kind, index) => (kind ? [{ index, rank: BREAK_PRIORITY.indexOf(kind) }] : []))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  return new Set(ranked.slice(0, MAX_BREAK_MOMENTS).map((entry) => entry.index));
}

export interface MomentsResult {
  events: AnalysisEvent[];
  final: SidePair;
  halftime: SidePair;
}

/**
 * Skoru olaylardan sayar, gollere skoru, seçilen (en fazla 2) olaya kırılma anını yazar. `withBreaks: false`
 * (skor resmi skorla tutmuyor) → skor sayılır ama etiket yazılmaz.
 */
export function withMoments(events: readonly AnalysisEvent[], withBreaks = true): MomentsResult {
  const scored = withScores(events);
  if (!withBreaks) return scored;
  const candidates = breakCandidates(scored.events, scored.final);
  const chosen = pickBreakMoments(candidates);
  const out = scored.events.map((event, index): AnalysisEvent => {
    const kind = chosen.has(index) ? candidates[index] : null;
    const moment: BreakMoment | null = kind ? { kind, label: BREAK_LABELS[kind] } : null;
    return { ...event, breakMoment: moment };
  });
  return { ...scored, events: out };
}
