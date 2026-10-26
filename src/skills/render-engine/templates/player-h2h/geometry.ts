import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { px } from "../match-day/shared";
import type { FrameBox } from "../match-result/geometry";
import { photoSplit, safeBox, type BlockSlot, type PhotoSplit } from "../vitrin/geometry";

/**
 * Oyuncu karşılaştırmasının geometrisi — TEK KAYNAK (şablonlar, yerleşim kapısı, poster fotoğraf
 * katmanı ve satır kapasitesi aynı sayıları okur). Vitrin posteriyle aynı dil: dikeyde üstte iki
 * fotoğraf çapraz bölünmüş; alttan yukarı künye ← olgu ← 3 kahraman ← adalet etiketi ← oyuncu adları.
 * 16:9'da fotoğraflar solda, yığın sağda. 02 Karşılaştırma: yüzler ← kelebek grafiği ← dipnot.
 * Temel ölçüler 4:5'te k = 1.
 */

export const H2H_SIZES = {
  header: 18,
  headerGap: 40,
  logoHeight: 34,
  footerGap: 36,
  footerSize: 23,
  // Poster
  teamLogo: 60,
  firstName: 22,
  name: 84,
  subtitle: 20,
  players: 60 + 14 + 22 + 8 + 84 + 12 + 20,
  playersGap: 40,
  modeLabel: 18,
  modeGap: 22,
  hero: 140,
  /** 90 dk modunda değerin altındaki gerçek toplam ("TOPLAM 8"); toplam modunda boş kalır (yerleşim sabit). */
  heroCaption: 18,
  heroCaptionGap: 8,
  heroGap: 14,
  heroLabel: 26,
  factGap: 36,
  fact: 32,
  // Karşılaştırma
  face: 104,
  facesGap: 36,
  groupLabel: 18,
  groupLabelGap: 12,
  groupGap: 22,
  rowMax: 66,
  rowMin: 40,
  labelColumn: 300,
  valueWidth: 120,
  bar: 12,
  footnoteLine: 20,
  footnoteLines: 3,
  footnoteGap: 28,
} as const;

const BASE_BOX_HEIGHT = 1350 - 2 * 64;

export interface H2HPosterGeometry {
  page: "poster";
  frame: MatchDayFrame;
  k: number;
  box: FrameBox;
  column: { left: number; right: number };
  players: BlockSlot;
  modeLabel: BlockSlot;
  hero: BlockSlot;
  fact: BlockSlot;
  photo: PhotoSplit;
  shade: { direction: "down" | "right"; start: number; solid: number };
}

export interface H2HCompareGeometry {
  page: "compare";
  frame: MatchDayFrame;
  k: number;
  box: FrameBox;
  faces: BlockSlot;
  chart: BlockSlot;
  footnote: BlockSlot;
}

export type H2HGeometry = H2HPosterGeometry | H2HCompareGeometry;

/** Kahraman satırı: değer + toplam satırı. */
export const heroRow = () => H2H_SIZES.hero + H2H_SIZES.heroCaptionGap + H2H_SIZES.heroCaption;

/** Posterin yığını (künye hariç): adlar · adalet · kahramanlar · olgu. */
function posterStack(): number {
  const s = H2H_SIZES;
  return s.players + s.playersGap + s.modeLabel + s.modeGap + 3 * heroRow() + 2 * s.heroGap + s.factGap + s.fact;
}

/** Yığın alttan yukarı, künyenin üstünden; `bottom` künye bloğunun üst kenarı. */
function posterSlots(bottom: number, k: number) {
  const s = H2H_SIZES;
  const fact = { top: bottom - px(s.fact, k), height: px(s.fact, k) };
  const heroHeight = px(3 * heroRow() + 2 * s.heroGap, k);
  const hero = { top: fact.top - px(s.factGap, k) - heroHeight, height: heroHeight };
  const modeLabel = { top: hero.top - px(s.modeGap + s.modeLabel, k), height: px(s.modeLabel, k) };
  const players = { top: modeLabel.top - px(s.playersGap + s.players, k), height: px(s.players, k) };
  return { players, modeLabel, hero, fact };
}

export function h2hPosterGeometry(frame: MatchDayFrame): H2HPosterGeometry {
  const s = H2H_SIZES;
  const box = safeBox(frame);
  if (frame.orientation === "landscape") {
    const column = { left: Math.round(frame.width * 0.53), right: box.right };
    const available = box.bottom - box.top - (s.header + s.headerGap + s.logoHeight + s.footerGap);
    const k = Math.min(1, available / posterStack());
    const slots = posterSlots(box.bottom - px(s.logoHeight + s.footerGap, k), k);
    const region = { left: 0, right: Math.round(frame.width * 0.5), top: 0, bottom: frame.height };
    return {
      page: "poster",
      frame,
      k,
      box: { ...box, left: column.left },
      column,
      ...slots,
      photo: photoSplit(region, Math.round(frame.width * 0.3), Math.round(frame.width * 0.2), box.top, box.bottom, px(28, k)),
      shade: { direction: "right", start: Math.round(frame.width * 0.36), solid: column.left - px(24, k) },
    };
  }
  const k = Math.min(1, (box.bottom - box.top) / BASE_BOX_HEIGHT);
  const slots = posterSlots(box.bottom - px(s.logoHeight + s.footerGap, k), k);
  const region = { left: 0, right: frame.width, top: 0, bottom: slots.players.top + px(140, k) };
  const headerBottom = box.top + px(s.header + s.headerGap, k);
  // Yüzler adların üstündeki açık bölgede; gradyan adların biraz üstünde başlar.
  const start = Math.max(headerBottom, slots.players.top - px(140, k));
  return {
    page: "poster",
    frame,
    k,
    box,
    column: { left: box.left, right: box.right },
    ...slots,
    photo: photoSplit(region, Math.round(frame.width * 0.58), Math.round(frame.width * 0.42), headerBottom, slots.players.top, px(24, k)),
    shade: { direction: "down", start, solid: slots.players.top + px(90, k) },
  };
}

export function h2hCompareGeometry(frame: MatchDayFrame): H2HCompareGeometry {
  const s = H2H_SIZES;
  const box = safeBox(frame);
  // 16:9'da yazılar okunur kalsın diye ölçek sabit; satır kapasitesi azalır (düşük öncelikliler düşer).
  const k = frame.orientation === "landscape" ? 0.6 : Math.min(1, (box.bottom - box.top) / BASE_BOX_HEIGHT);
  const faces = { top: box.top + px(s.header + s.headerGap, k), height: px(s.face, k) };
  const footnoteHeight = px(s.footnoteLines * s.footnoteLine + (s.footnoteLines - 1) * 8, k);
  const footnote = { top: box.bottom - px(s.logoHeight + s.footerGap, k) - footnoteHeight, height: footnoteHeight };
  const chartTop = faces.top + faces.height + px(s.facesGap, k);
  const chart = { top: chartTop, height: footnote.top - px(s.footnoteGap, k) - chartTop };
  return { page: "compare", frame, k, box, faces, chart, footnote };
}

/** Grup başlıklarının kapladığı yükseklik. */
const groupsHeight = (groups: number, k: number) => px(groups * (H2H_SIZES.groupLabel + H2H_SIZES.groupLabelGap) + Math.max(0, groups - 1) * H2H_SIZES.groupGap, k);

/** Grafiğin dolu yüksekliği (başlıklar + satırlar) — boşluk varsa grafik alanda dikey ortalanır. */
export function chartContentHeight(g: H2HCompareGeometry, rows: number, groups: number, rowHeight: number): number {
  return groupsHeight(groups, g.k) + rows * rowHeight;
}

/** Satır yüksekliği: alan satırlara bölünür, [rowMin, rowMax] aralığında. Sığmıyorsa null. */
export function chartRowHeight(g: H2HCompareGeometry, rows: number, groups: number): number | null {
  if (rows === 0) return px(H2H_SIZES.rowMax, g.k);
  const height = (g.chart.height - groupsHeight(groups, g.k)) / rows;
  if (height < px(H2H_SIZES.rowMin, g.k)) return null;
  return Math.min(px(H2H_SIZES.rowMax, g.k), Math.floor(height));
}
