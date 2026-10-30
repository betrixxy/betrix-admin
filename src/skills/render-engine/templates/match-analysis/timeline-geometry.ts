import type { TimelineRowCard } from "@/types/match-analysis";
import type { MatchSide } from "@/types/match-result";
import { px } from "../match-day/shared";
import type { AnalysisGeometry, Band } from "./geometry";

/**
 * 01 · ZAMAN ÇİZELGESİ geometrisi (deterministik). Dikey: ortada dakika omurgası, ev sahibi solda, deplasman
 * sağda; satırlar sıralı (eşit aralık, okunurluk için orantılı değil), devre arası / maç sonu ayraç satırı.
 * 16:9: yatay dakika ekseni 0–90+ (ilk yarı uzatmaları için eksende ayrı pay — "45+2'" 46'dan önce), ev
 * sahibi eksenin üstünde, deplasman altında; etiketler çakışmasın diye şeritlere (lane) açgözlü yerleşir.
 * Sığmazsa `planTimeline` yoğunluk kuralı devreye girer (bkz. `lib/match-analysis/timeline.ts`).
 */

export const VERTICAL_TIMELINE = { row: 60, rowMin: 36, divider: 0.7, pill: 100, gap: 14, text: 24 } as const;

export type TimelineSlotKind = "row" | "divider";

export interface VerticalTimeline {
  rowHeight: number;
  /** Satır ve ayraçların üst kenarları, sırayla. */
  slots: { kind: TimelineSlotKind; top: number; height: number }[];
  center: number;
  pillWidth: number;
  /** Bir tarafın içerik genişliği (omurga + boşluk dışında). */
  sideWidth: number;
  top: number;
  height: number;
}

const units = (rows: number, dividers: number) => rows + dividers * VERTICAL_TIMELINE.divider;

export function verticalFits(g: AnalysisGeometry, rows: number, dividers: number): boolean {
  return units(rows, dividers) * px(VERTICAL_TIMELINE.rowMin, g.k) <= g.body.height;
}

export function verticalTimeline(g: AnalysisGeometry, kinds: readonly TimelineSlotKind[]): VerticalTimeline {
  const t = VERTICAL_TIMELINE;
  const rows = kinds.filter((kind) => kind === "row").length;
  const total = units(rows, kinds.length - rows);
  const rowHeight = Math.max(px(t.rowMin, g.k), Math.min(px(t.row, g.k), Math.floor(g.body.height / Math.max(1, total))));
  const dividerHeight = Math.round(rowHeight * t.divider);
  const height = rows * rowHeight + (kinds.length - rows) * dividerHeight;
  const top = g.body.top + Math.max(0, Math.floor((g.body.height - height) / 2));
  let y = top;
  const slots = kinds.map((kind) => {
    const slot = { kind, top: y, height: kind === "row" ? rowHeight : dividerHeight };
    y += slot.height;
    return slot;
  });
  const center = Math.round((g.box.left + g.box.right) / 2);
  const pillWidth = px(t.pill, g.k);
  return { rowHeight, slots, center, pillWidth, sideWidth: Math.floor((g.box.right - g.box.left - pillWidth) / 2) - px(t.gap, g.k), top, height };
}

/* ---------- 16:9 yatay eksen ---------- */

export const LANE = { lane: 32, laneMin: 26, text: 14, axisBand: 38, pad: 8, gap: 12, edge: 24 } as const;
/** Devre uzatmalarının eksendeki payı (dakika birimi) — "45+x'" bu payın içinde, 46' sonrasında. */
const STOPPAGE_UNITS = 4;
const STOPPAGE_STEP = 0.5;

export function axisUnits(elapsed: number, extra: number | null, axisEnd: 90 | 120): number {
  const stoppage = Math.min(extra ?? 0, STOPPAGE_UNITS / STOPPAGE_STEP) * STOPPAGE_STEP;
  if (elapsed <= 45) return elapsed + (elapsed === 45 ? stoppage : 0);
  if (elapsed <= 90 || axisEnd === 90) return STOPPAGE_UNITS + Math.min(elapsed, 90) + (elapsed === 90 ? stoppage : 0);
  return 2 * STOPPAGE_UNITS + Math.min(elapsed, 120) + (elapsed === 120 ? stoppage : 0);
}

export const axisTotal = (axisEnd: 90 | 120) => axisUnits(axisEnd, STOPPAGE_UNITS / STOPPAGE_STEP, axisEnd);

export interface AxisLine {
  left: number;
  right: number;
  y: number;
  band: Band;
}

export function axisLine(g: AnalysisGeometry): AxisLine {
  const band = { top: g.body.top + Math.round((g.body.height - LANE.axisBand) / 2), height: LANE.axisBand };
  return { left: g.box.left + LANE.edge, right: g.box.right - LANE.edge, y: band.top + 10, band };
}

export const axisX = (axis: AxisLine, value: number, axisEnd: 90 | 120) => Math.round(axis.left + ((axis.right - axis.left) * value) / axisTotal(axisEnd));

/** Etiket metni: "12' V. OSIMHEN (P) 0-1" — şablon da aynısını çizer. */
export const laneLabelText = (row: Pick<TimelineRowCard, "minuteLabel" | "text" | "mark" | "scoreLabel">) => [row.minuteLabel, row.text, row.mark, row.scoreLabel].filter(Boolean).join(" ");

/** Geist kalın büyük harf ≈ 0,64 em + ikon + iç boşluk. */
export const laneLabelWidth = (row: Pick<TimelineRowCard, "minuteLabel" | "text" | "mark" | "scoreLabel">, size: number) => Math.ceil(laneLabelText(row).length * size * 0.64) + Math.round(size * 1.3) + 2 * LANE.pad;

/** Şerit yüksekliğine göre etiket yazı boyu (geometri ve şablon aynı). */
export const laneTextSize = (laneHeight: number) => Math.round(LANE.text * (laneHeight / LANE.lane));

export interface LanePlacement {
  row: number;
  side: MatchSide;
  x: number;
  left: number;
  width: number;
  lane: number;
}

export interface LaneLayout {
  ok: boolean;
  axis: AxisLine;
  laneHeight: number;
  maxLanes: number;
  placements: LanePlacement[];
}

/** Bir taraftaki şerit sayısı üst sınırı: gövdenin yarısı / şerit yüksekliği. */
function laneCapacity(g: AnalysisGeometry, axis: AxisLine, laneHeight: number): number {
  const above = axis.band.top - g.body.top;
  return Math.max(1, Math.floor(above / laneHeight));
}

export function laneLayout(g: AnalysisGeometry, rows: readonly TimelineRowCard[], axisEnd: 90 | 120): LaneLayout {
  const axis = axisLine(g);
  for (let laneHeight: number = LANE.lane; laneHeight >= LANE.laneMin; laneHeight -= 2) {
    const size = laneTextSize(laneHeight);
    const maxLanes = laneCapacity(g, axis, laneHeight);
    const ends: Record<MatchSide, number[]> = { HOME: [], AWAY: [] };
    const placements: LanePlacement[] = [];
    let ok = true;
    rows.forEach((row, index) => {
      const x = axisX(axis, axisUnits(row.elapsed, row.extra, axisEnd), axisEnd);
      const width = laneLabelWidth(row, size);
      const left = Math.max(axis.left - LANE.edge, Math.min(x - Math.round(size * 0.65) - LANE.pad, axis.right + LANE.edge - width));
      const lanes = ends[row.side];
      let lane = lanes.findIndex((end) => end + LANE.gap <= left);
      if (lane < 0) lane = lanes.length;
      if (lane >= maxLanes) ok = false;
      lanes[lane] = left + width;
      placements.push({ row: index, side: row.side, x, left, width, lane });
    });
    if (ok) return { ok, axis, laneHeight, maxLanes, placements };
  }
  return { ok: false, axis, laneHeight: LANE.laneMin, maxLanes: laneCapacity(g, axis, LANE.laneMin), placements: [] };
}
