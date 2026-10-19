import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { px } from "../match-day/shared";
import { SAFE_MARGIN, type FrameBox } from "../match-result/geometry";

/**
 * Vitrin carousel'inin geometrisi — TEK KAYNAK: iki sayfanın Satori şablonları, yerleşim kapısı ve
 * posterin çapraz bölünmüş fotoğraf katmanı (`vitrin-photo.ts`) aynı sayıları okur.
 *
 * 01 Poster — dikeyde (4:5, 1:1, 9:16) üstte iki takımın fotoğrafı çapraz bölünmüş tam kadraj, alttan
 * yukarı: künye ← manşet ← kazanma çubuğu ← takım adları. 16:9'da fotoğraflar solda, yığın sağda.
 * 02 Analiz — dikeyde üstten: form ← açık kutu 2 (gösterge) ← 1. kutunun gerekçe satırı ← kilitli
 * bilet ← kanca; boşluk bloklar arasına eşit dağılır. 16:9'da iki sütun.
 * Temel ölçüler 4:5'te k = 1; 9:16 platform bantlarını boş bırakır (kalan alan 4:5 ile aynı).
 */

export const VITRIN_SIZES = {
  header: 18,
  headerGap: 40,
  footerSize: 23,
  logoHeight: 34,
  footerGap: 40,
  // Poster
  teams: 104,
  bar: 60,
  barPercent: 92,
  barLabel: 22,
  barGap: 40,
  headline: 44,
  headlineGap: 44,
  // Analiz
  sectionLabel: 20,
  sectionLabelGap: 18,
  formRow: 56,
  formRowGap: 16,
  gauge: 220,
  reasonLine: 30,
  ticket: 330,
  hook: 34,
  gap: 40,
} as const;

/** 4:5 içerik kutusunun yüksekliği — k bu yüksekliğe göre (1:1 küçülür, 9:16 aynı). */
const BASE_BOX_HEIGHT = 1350 - 2 * SAFE_MARGIN;

export interface BlockSlot {
  top: number;
  height: number;
}

/** Çapraz bölünmüş fotoğraf bölgesi: ev sahibi solda, deplasman sağda; ayrım çizgisi üstte `topX`, altta `bottomX`. */
export interface PhotoSplit {
  /** Fotoğrafların kapladığı bölge (çerçeve koordinatı). */
  region: FrameBox;
  topX: number;
  bottomX: number;
  /** Her tarafın kırpılacağı panel (bölgenin bir dilimi, çapraz çizgiyi kapsar). */
  panels: { home: FrameBox; away: FrameBox };
  /** Yüzlerin duracağı yazısız bölge — panel koordinatında. */
  safe: { home: FrameBox; away: FrameBox };
}

export interface PosterGeometry {
  page: "poster";
  frame: MatchDayFrame;
  k: number;
  /** Başlık (etiket + tarih) ve künyenin kutusu. */
  box: FrameBox;
  /** Takımlar · çubuk · manşet bu yatay aralıkta. */
  column: { left: number; right: number };
  teams: BlockSlot;
  bar: BlockSlot;
  headline: BlockSlot;
  photo: PhotoSplit;
  /** Koyu gradyan: dikeyde üstten y, yatayda soldan x — `start` şeffaf, `solid` tam koyu. */
  shade: { direction: "down" | "right"; start: number; solid: number };
}

export interface AnalysisColumn {
  left: number;
  right: number;
}

export interface AnalysisGeometry {
  page: "analysis";
  frame: MatchDayFrame;
  k: number;
  box: FrameBox;
  /** Bloğun yatay aralığı (16:9'da iki sütun). */
  columns: { form: AnalysisColumn; open: AnalysisColumn; reasonLine: AnalysisColumn; locked: AnalysisColumn; hook: AnalysisColumn };
  form: BlockSlot;
  open: BlockSlot;
  reasonLine: BlockSlot;
  locked: BlockSlot;
  hook: BlockSlot;
  /** 16:9'da göstergenin altına gerekçe (dar sütun); dikeyde yan yana. */
  openStacked: boolean;
}

export type VitrinGeometry = PosterGeometry | AnalysisGeometry;

const safeBox = (frame: MatchDayFrame): FrameBox => ({ left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN });

/** Başlıktan sonra, künyeden önce kalan dikey aralık. */
function bodyRange(box: FrameBox, k: number) {
  const s = VITRIN_SIZES;
  return { top: box.top + px(s.header + s.headerGap, k), bottom: box.bottom - px(s.logoHeight + s.footerGap, k) };
}

/**
 * Yukarıdan aşağı yığın: bloklar sırayla, aralarındaki temel boşluklar `k` ile; kalan dikey alan
 * blok aralarına eşit dağıtılır (ilk bloktan önce ve son bloktan sonra boşluk yok).
 */
function stackDown(top: number, bottom: number, k: number, heights: number[], gaps: number[]): BlockSlot[] {
  const scaled = heights.map((height) => px(height, k));
  const scaledGaps = gaps.map((gap) => px(gap, k));
  const used = scaled.reduce((sum, h) => sum + h, 0) + scaledGaps.reduce((sum, g) => sum + g, 0);
  const extra = gaps.length > 0 ? Math.max(0, bottom - top - used) / gaps.length : 0;
  let y = top;
  return scaled.map((height, index) => {
    const slot = { top: Math.round(y), height };
    y += height + (index < gaps.length ? (scaledGaps[index] ?? 0) + extra : 0);
    return slot;
  });
}

/** Panel ve yazısız bölgeler: çizginin iki yanı, kenarlardan `pad` içeride. */
function photoSplit(region: FrameBox, topX: number, bottomX: number, safeTop: number, safeBottom: number, pad: number): PhotoSplit {
  const split = Math.max(topX, bottomX);
  const awayStart = Math.min(topX, bottomX);
  const home = { left: region.left, right: split, top: region.top, bottom: region.bottom };
  const away = { left: awayStart, right: region.right, top: region.top, bottom: region.bottom };
  const toPanel = (panel: FrameBox, left: number, right: number): FrameBox => ({ left: left - panel.left, right: right - panel.left, top: safeTop - panel.top, bottom: safeBottom - panel.top });
  return {
    region,
    topX,
    bottomX,
    panels: { home, away },
    safe: { home: toPanel(home, region.left + pad, awayStart - pad), away: toPanel(away, split + pad, region.right - pad) },
  };
}

export function posterGeometry(frame: MatchDayFrame): PosterGeometry {
  const s = VITRIN_SIZES;
  const box = safeBox(frame);
  if (frame.orientation === "landscape") {
    const column = { left: Math.round(frame.width * 0.53), right: box.right };
    const stack = s.teams + s.barGap + s.bar + 16 + s.barPercent + 6 + s.barLabel + s.headlineGap + s.headline;
    const body = bodyRange(box, 1);
    const k = Math.min(1, (body.bottom - body.top) / (stack + 2 * s.gap));
    const range = bodyRange(box, k);
    const middle = (range.top + range.bottom) / 2;
    const top = Math.round(middle - px(stack, k) / 2);
    const [teams, bar, headline] = stackDown(top, top + px(stack, k), k, [s.teams, s.bar + 16 + s.barPercent + 6 + s.barLabel, s.headline], [s.barGap, s.headlineGap]) as [BlockSlot, BlockSlot, BlockSlot];
    const region = { left: 0, right: Math.round(frame.width * 0.5), top: 0, bottom: frame.height };
    return {
      page: "poster",
      frame,
      k,
      box: { ...box, left: column.left },
      column,
      teams,
      bar,
      headline,
      photo: photoSplit(region, Math.round(frame.width * 0.3), Math.round(frame.width * 0.2), box.top, box.bottom, px(28, k)),
      shade: { direction: "right", start: Math.round(frame.width * 0.36), solid: column.left - px(24, k) },
    };
  }
  const k = Math.min(1, (box.bottom - box.top) / BASE_BOX_HEIGHT);
  const footerTop = box.bottom - px(s.logoHeight + s.footerGap, k);
  const headline = { top: footerTop - px(s.headline, k), height: px(s.headline, k) };
  const barHeight = px(s.bar + 16 + s.barPercent + 6 + s.barLabel, k);
  const bar = { top: headline.top - px(s.headlineGap, k) - barHeight, height: barHeight };
  const teams = { top: bar.top - px(s.barGap, k) - px(s.teams, k), height: px(s.teams, k) };
  const photoBottom = teams.top + px(70, k);
  const region = { left: 0, right: frame.width, top: 0, bottom: photoBottom };
  const start = Math.max(box.top + px(s.header + s.headerGap, k), teams.top - px(330, k));
  return {
    page: "poster",
    frame,
    k,
    box,
    column: { left: box.left, right: box.right },
    teams,
    bar,
    headline,
    photo: photoSplit(region, Math.round(frame.width * 0.58), Math.round(frame.width * 0.42), box.top + px(s.header + s.headerGap, k), start + px(80, k), px(24, k)),
    shade: { direction: "down", start, solid: teams.top + px(24, k) },
  };
}

const formHeight = () => {
  const s = VITRIN_SIZES;
  return s.sectionLabel + s.sectionLabelGap + 2 * s.formRow + s.formRowGap;
};
const openHeight = (stacked: boolean) => {
  const s = VITRIN_SIZES;
  // Yan yana: gösterge satırı; alt alta: gösterge + iki satırlık gerekçe.
  return s.sectionLabel + s.sectionLabelGap + s.gauge + (stacked ? 16 + 92 : 0);
};

export function analysisGeometry(frame: MatchDayFrame): AnalysisGeometry {
  const s = VITRIN_SIZES;
  const box = safeBox(frame);
  if (frame.orientation === "landscape") {
    const gutter = 56;
    const mid = Math.round((box.left + box.right) / 2);
    const left = { left: box.left, right: mid - gutter / 2 };
    const right = { left: mid + gutter / 2, right: box.right };
    const leftStack = [formHeight(), s.reasonLine, s.ticket];
    const rightStack = [openHeight(true), s.hook];
    const body = bodyRange(box, 1);
    const height = body.bottom - body.top;
    const k = Math.min(1, height / (leftStack.reduce((a, b) => a + b, 0) + 2 * 24), height / (rightStack.reduce((a, b) => a + b, 0) + 24));
    const range = bodyRange(box, k);
    const [form, reasonLine, locked] = stackDown(range.top, range.bottom, k, leftStack, [24, 24]) as [BlockSlot, BlockSlot, BlockSlot];
    const [open, hook] = stackDown(range.top, range.bottom, k, rightStack, [24]) as [BlockSlot, BlockSlot];
    return { page: "analysis", frame, k, box, columns: { form: left, reasonLine: left, locked: left, open: right, hook: right }, form, open, reasonLine, locked, hook, openStacked: true };
  }
  const k = Math.min(1, (box.bottom - box.top) / BASE_BOX_HEIGHT);
  const range = bodyRange(box, k);
  const [form, open, reasonLine, locked, hook] = stackDown(range.top, range.bottom, k, [formHeight(), openHeight(false), s.reasonLine, s.ticket, s.hook], [s.gap, 20, s.gap, 32]) as [BlockSlot, BlockSlot, BlockSlot, BlockSlot, BlockSlot];
  const full = { left: box.left, right: box.right };
  return { page: "analysis", frame, k, box, columns: { form: full, open: full, reasonLine: full, locked: full, hook: full }, form, open, reasonLine, locked, hook, openStacked: false };
}
