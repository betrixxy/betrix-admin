import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { px } from "../match-day/shared";
import { SAFE_MARGIN, type FrameBox } from "../match-result/geometry";

/**
 * Kura sonucu kartının geometrisi — TEK KAYNAK (şablonlar, yerleşim kapısı, fotoğraf katmanı).
 * Poster sayfaları (A): tam kadraj fotoğraf; dikeyde alttan yukarı künye ← olgu ← sıra/tarih ← rakip ←
 * üst satır; 16:9'da fotoğraf solda, yığın sağda. Liste sayfaları (A ızgara, B, C): başlık + gövde alanı;
 * gövdenin satır düzeni şablonda bu alana göre hesaplanır. Temel ölçüler 4:5'te k = 1.
 */

export const DRAW_SIZES = {
  header: 18,
  headerGap: 40,
  logoHeight: 34,
  footerGap: 36,
  footerSize: 23,
  // Poster
  /** Üst satır yuvası (logo 1,5 × yazı); yazı boyu `kickerText`. */
  kicker: 42,
  kickerText: 28,
  kickerGap: 22,
  heroLogo: 150,
  heroName: 150,
  heroGap: 40,
  order: 30,
  orderGap: 12,
  dates: 24,
  factGap: 28,
  fact: 30,
  // Lig posteri
  headline: 116,
  summary: 26,
  // Liste sayfaları
  title: 92,
  /** Başlığın Ç/Ş/Ğ kuyruğu için ayrılan yer (≈ 0,25 × başlık; bkz. DISPLAY_DESCENT_EM) + alt satıra boşluk. */
  titleTail: 24,
  subtitleGap: 12,
  subtitle: 22,
  titleGap: 40,
} as const;

const BASE_BOX_HEIGHT = 1350 - 2 * SAFE_MARGIN;

export interface Slot {
  top: number;
  height: number;
}

export interface DrawPosterGeometry {
  page: "poster";
  frame: MatchDayFrame;
  k: number;
  box: FrameBox;
  column: { left: number; right: number };
  kicker: Slot;
  hero: Slot;
  meta: Slot;
  fact: Slot;
  /** Fotoğraf bölgesi ve yüzlerin duracağı yazısız bölge (çerçeve koordinatı). */
  photo: { region: FrameBox; safe: FrameBox };
  shade: { direction: "down" | "right"; start: number; solid: number };
}

export interface DrawListGeometry {
  page: "list";
  frame: MatchDayFrame;
  k: number;
  box: FrameBox;
  title: Slot;
  body: Slot;
}

export type DrawGeometry = DrawPosterGeometry | DrawListGeometry;

export const drawSafeBox = (frame: MatchDayFrame): FrameBox => ({ left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN });

/** Poster yığını (künye hariç). `league`: lig posteri (başlık + özet), değilse eleme posteri (rakip + sıra + olgu). */
function stackHeights(league: boolean) {
  const s = DRAW_SIZES;
  return league
    ? { kicker: s.kicker, hero: s.headline, meta: s.summary, fact: 0 }
    : { kicker: s.kicker, hero: Math.max(s.heroLogo, s.heroName), meta: s.order + s.orderGap + s.dates, fact: s.fact };
}

function posterSlots(bottom: number, k: number, league: boolean) {
  const s = DRAW_SIZES;
  const h = stackHeights(league);
  const fact = { top: bottom - px(h.fact, k), height: px(h.fact, k) };
  const meta = { top: fact.top - (h.fact ? px(s.factGap, k) : 0) - px(h.meta, k), height: px(h.meta, k) };
  const hero = { top: meta.top - px(s.heroGap, k) - px(h.hero, k), height: px(h.hero, k) };
  const kicker = { top: hero.top - px(s.kickerGap, k) - px(h.kicker, k), height: px(h.kicker, k) };
  return { kicker, hero, meta, fact };
}

const stackTotal = (league: boolean) => {
  const s = DRAW_SIZES;
  const h = stackHeights(league);
  return h.kicker + s.kickerGap + h.hero + s.heroGap + h.meta + (h.fact ? s.factGap + h.fact : 0);
};

export function drawPosterGeometry(frame: MatchDayFrame, league: boolean): DrawPosterGeometry {
  const s = DRAW_SIZES;
  const box = drawSafeBox(frame);
  if (frame.orientation === "landscape") {
    const column = { left: Math.round(frame.width * 0.5), right: box.right };
    const available = box.bottom - box.top - (s.header + s.headerGap + s.logoHeight + s.footerGap);
    const k = Math.min(1, available / stackTotal(league));
    const slots = posterSlots(box.bottom - px(s.logoHeight + s.footerGap, k), k, league);
    const region = { left: 0, right: Math.round(frame.width * 0.56), top: 0, bottom: frame.height };
    return {
      page: "poster",
      frame,
      k,
      box: { ...box, left: column.left },
      column,
      ...slots,
      photo: { region, safe: { left: box.left, right: column.left - px(40, k), top: box.top, bottom: box.bottom } },
      shade: { direction: "right", start: Math.round(frame.width * 0.3), solid: column.left - px(20, k) },
    };
  }
  const k = Math.min(1, (box.bottom - box.top) / BASE_BOX_HEIGHT);
  const slots = posterSlots(box.bottom - px(s.logoHeight + s.footerGap, k), k, league);
  const headerBottom = box.top + px(s.header + s.headerGap, k);
  const region = { left: 0, right: frame.width, top: 0, bottom: slots.kicker.top + px(180, k) };
  const start = Math.max(headerBottom, slots.kicker.top - px(260, k));
  return {
    page: "poster",
    frame,
    k,
    box,
    column: { left: box.left, right: box.right },
    ...slots,
    photo: { region, safe: { left: box.left, right: box.right, top: headerBottom, bottom: start + px(80, k) } },
    shade: { direction: "down", start, solid: slots.kicker.top + px(40, k) },
  };
}

export function drawListGeometry(frame: MatchDayFrame): DrawListGeometry {
  const s = DRAW_SIZES;
  const box = drawSafeBox(frame);
  const k = frame.orientation === "landscape" ? 0.62 : Math.min(1, (box.bottom - box.top) / BASE_BOX_HEIGHT);
  const title = { top: box.top + px(s.header + s.headerGap, k), height: px(s.title + s.titleTail + s.subtitleGap + s.subtitle, k) };
  const bodyTop = title.top + title.height + px(s.titleGap, k);
  const body = { top: bodyTop, height: box.bottom - px(s.logoHeight + s.footerGap, k) - bodyTop };
  return { page: "list", frame, k, box, title, body };
}
