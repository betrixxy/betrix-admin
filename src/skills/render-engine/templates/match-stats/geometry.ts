import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { ScorerLine } from "@/types/match-result";
import { landscapeColumnBox, type ColumnSide } from "../checkmatch-set/landscape";
import { SET_VERTICAL, setBlockBottom } from "../checkmatch-set/set-parts";
import { px } from "../match-day/shared";
import { matchResultGeometry, SAFE_MARGIN, type FrameBox } from "../match-result/geometry";

/**
 * Maç İstatistikleri geometrisi. Dikey ailede içerik kutusu ve ölçek (`k`) Maç Sonucu'nun
 * geometrisinden okunur — set bloğu (başlık + skor şeridi + golcüler) iki kartta piksel piksel
 * aynı yerde durur. Satırlar sayfa etiketi ile set bloğu arasındaki alana yerleşir; omurga
 * panelin üst kenarından set bloğunun başlık yuvasına iner (oradan rozete `SetScoreBlock` çizer).
 * 16:9'da set sütunu Maç Sonucu'nunkiyle aynı kutudur (`landscapeColumnBox`) ve aynı tarafta durur.
 */

export { SAFE_MARGIN };

export interface StatsGeometry {
  frame: MatchDayFrame;
  k: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** 16:9 set sütununun tarafı — 01 aynalandıysa 02 de aynalanır (carousel tutarlılığı). */
  side: ColumnSide;
  column: FrameBox | null;
}

export function matchStatsGeometry(frame: MatchDayFrame, side: ColumnSide = "right"): StatsGeometry {
  const { k, top, bottom, left, right } = matchResultGeometry(frame);
  return frame.orientation === "landscape"
    ? { frame, k: 1, top: SAFE_MARGIN, bottom: frame.height - SAFE_MARGIN, left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, side, column: landscapeColumnBox(frame, side) }
    : { frame, k, top, bottom, left, right, side: "right", column: null };
}

/** Sayfa etiketi satırının yüksekliği + altındaki boşluk. */
export const PAGE_LABEL_SPACE = 18 + 36;

/**
 * Set bloğunun üst kenarı (y) — golcü satır sayısından deterministik hesaplanır (Satori ölçüm
 * vermez). Golcü satırı: üst boşluk 0,5em + satır ≈ 1,2em.
 */
export function setBlockTop(g: StatsGeometry, homeScorers: ScorerLine[], awayScorers: ScorerLine[]): number {
  const v = SET_VERTICAL;
  const scorerRows = Math.max(homeScorers.length, awayScorers.length);
  const scorerHeight = scorerRows * Math.round(px(v.scorerSize, g.k) * 1.7);
  const height = px(v.headlineSlot, g.k) + px(v.headlineGap, g.k) + px(v.scoreSize, g.k) + px(v.scorerGap, g.k) + scorerHeight;
  return setBlockBottom(g, g.k) - height;
}
