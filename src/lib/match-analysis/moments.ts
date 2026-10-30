import { SCORING_KINDS, SENDING_OFF_KINDS, type AnalysisEvent, type BreakMoment, type SidePair } from "@/types/match-analysis";
import type { MatchSide } from "@/types/match-result";

/**
 * Akan skor + KIRILMA ANI (saf, deterministik). Olaylar sıralı gelir (`sortEvents`).
 *
 * Kırılma anı kuralları (öncelik sırasıyla, bir olaya tek etiket):
 *  1. KIRMIZI SONRASI — rakibi kırmızı kart (ya da ikinci sarı) gördükten sonraki `AFTER_RED_WINDOW` dakika
 *     içinde atılan gol (fark açan gol de olsa: sayısal üstünlüğün sonucu).
 *  2. İLK GOL — 0-0 bozuldu.
 *  3. EŞİTLİK — gol skoru eşitledi.
 *  4. EŞİTLİK BOZULDU — berabere skordan (1-1, 2-2…) öne geçildi.
 *  5. 10 KİŞİ / 9 KİŞİ — kırmızı kartın kendisi (takım bir kişi eksildi).
 * Farkı açan ya da azaltan gol (2-0 → 3-0, 2-0 → 2-1) kırılma anı DEĞİLDİR. Kaçan penaltı, sarı kart,
 * değişiklik ve VAR skoru değiştirmez.
 */

export const AFTER_RED_WINDOW = 15;
export const BREAK_LABELS = { FIRST_GOAL: "İLK GOL", EQUALISER: "EŞİTLİK", GO_AHEAD: "EŞİTLİK BOZULDU", AFTER_RED: "KIRMIZI SONRASI" } as const;

const other = (side: MatchSide): MatchSide => (side === "HOME" ? "AWAY" : "HOME");
export const isScoring = (event: Pick<AnalysisEvent, "kind">) => SCORING_KINDS.includes(event.kind);
export const isSendingOff = (event: Pick<AnalysisEvent, "kind">) => SENDING_OFF_KINDS.includes(event.kind);
/** Uzatma dakikası dahil yaklaşık maç dakikası (pencere hesabı için). */
export const matchMinute = (event: Pick<AnalysisEvent, "elapsed" | "extra">) => event.elapsed + (event.extra ?? 0);
/** İlk yarı olayı mı: 45 ve 45+ dahil. */
export const isFirstHalf = (event: Pick<AnalysisEvent, "elapsed">) => event.elapsed <= 45;

function goalMoment(before: SidePair, after: SidePair, lastRedAgainst: number | null, minute: number): BreakMoment | null {
  if (lastRedAgainst !== null && minute - lastRedAgainst <= AFTER_RED_WINDOW) return { kind: "AFTER_RED", label: BREAK_LABELS.AFTER_RED };
  if (before.home === 0 && before.away === 0) return { kind: "FIRST_GOAL", label: BREAK_LABELS.FIRST_GOAL };
  if (after.home === after.away) return { kind: "EQUALISER", label: BREAK_LABELS.EQUALISER };
  if (before.home === before.away) return { kind: "GO_AHEAD", label: BREAK_LABELS.GO_AHEAD };
  return null;
}

export interface MomentsResult {
  events: AnalysisEvent[];
  final: SidePair;
  halftime: SidePair;
}

/**
 * Skoru olaylardan sayar, gollere skoru ve kırılma anını yazar. `withBreaks: false` (skor resmi skorla
 * tutmuyor) → skor sayılır ama etiket yazılmaz.
 */
export function withMoments(events: readonly AnalysisEvent[], withBreaks = true): MomentsResult {
  const score: SidePair = { home: 0, away: 0 };
  const halftime: SidePair = { home: 0, away: 0 };
  const sentOff: Record<MatchSide, number> = { HOME: 0, AWAY: 0 };
  const lastRed: Record<MatchSide, number | null> = { HOME: null, AWAY: null };
  const out = events.map((event): AnalysisEvent => {
    if (isScoring(event)) {
      const before = { ...score };
      if (event.side === "HOME") score.home += 1;
      else score.away += 1;
      if (isFirstHalf(event)) {
        if (event.side === "HOME") halftime.home += 1;
        else halftime.away += 1;
      }
      const moment = withBreaks ? goalMoment(before, score, lastRed[other(event.side)], matchMinute(event)) : null;
      return { ...event, score: { ...score }, breakMoment: moment };
    }
    if (isSendingOff(event)) {
      sentOff[event.side] += 1;
      lastRed[event.side] = matchMinute(event);
      const label = `${11 - sentOff[event.side]} KİŞİ`;
      return { ...event, score: null, breakMoment: withBreaks ? { kind: "SENT_OFF", label } : null };
    }
    return { ...event, score: null, breakMoment: null };
  });
  return { events: out, final: { ...score }, halftime };
}
