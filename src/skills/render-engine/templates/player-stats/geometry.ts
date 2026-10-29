import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { SpotlightCard, TopPlayersCard } from "@/types/player-match-stats";
import type { ColumnSide } from "../checkmatch-set/landscape";
import { px } from "../match-day/shared";
import { SAFE_MARGIN, type FrameBox, type ResultGeometry } from "../match-result/geometry";

/**
 * Oyuncu İstatistikleri geometrisi — TEK KAYNAK: Satori blokları ve tam kadraj fotoğrafın akıllı kırpması
 * (`photo.photoSafe`, `match-photo/` hattı) aynı sayıları okur. Dikeyde yazı bloğu alttan sabitlenir
 * (künye → dipnot → kompakt satırlar → kahraman → olgu → puan + ad), fotoğrafın yüzleri bloğun üstünde
 * kalır. 16:9'da blok bir yanda panel (ölçek `LANDSCAPE_K`), fotoğraf öbür yanda; özne sağdaysa panel
 * sola aynalanır (`side`, Maç Sonucu kuralı). Bloklar deterministik hesaplanır (Satori ölçüm vermez).
 */

export const PLAYER_SIZES = {
  headerSpace: 54,
  rating: 150,
  ratingGap: 26,
  nameMax: 76,
  nameMin: 34,
  meta: 21,
  nameGap: 12,
  gap: 28,
  fact: 26,
  heroValue: 112,
  heroLabel: 17,
  heroLabelGap: 14,
  rowHeight: 46,
  rowLabel: 18,
  rowValue: 26,
  footnote: 15,
  footnoteGap: 20,
  footerMatch: 24,
  footerMeta: 17,
  footerLineGap: 9,
  logo: 34,
  title: 92,
  titleGap: 44,
} as const;

const LANDSCAPE_K = 0.66;
const LANDSCAPE_PANEL = 560;
const LANDSCAPE_HEADER = 44;

export interface Band {
  top: number;
  height: number;
}

export interface PlayerFrame {
  frame: MatchDayFrame;
  k: number;
  /** İçerik kutusu (sayfa etiketi bunun üstüne). */
  box: FrameBox;
  /** Yazı paneli: dikeyde içerik kutusu, 16:9'da bir yan. */
  panel: FrameBox;
  side: ColumnSide;
  footer: Band;
  footnote: Band;
}

function frameBoxes(frame: MatchDayFrame, side: ColumnSide): Omit<PlayerFrame, "footer" | "footnote"> {
  if (frame.orientation === "landscape") {
    const box = { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: SAFE_MARGIN, bottom: frame.height - SAFE_MARGIN };
    const left = side === "right" ? box.right - LANDSCAPE_PANEL : box.left;
    return { frame, k: LANDSCAPE_K, box, side, panel: { left, right: left + LANDSCAPE_PANEL, top: box.top + LANDSCAPE_HEADER, bottom: box.bottom } };
  }
  const k = Math.min(1, frame.height / 1350);
  const box = { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN };
  return { frame, k, box, side: "right", panel: { ...box, top: box.top + px(PLAYER_SIZES.headerSpace, k) } };
}

function withFooter(base: Omit<PlayerFrame, "footer" | "footnote">): PlayerFrame {
  const s = PLAYER_SIZES;
  const k = base.k;
  const footerHeight = px(s.footerMatch + s.footerLineGap + s.footerMeta, k);
  const footer = { top: base.panel.bottom - footerHeight, height: footerHeight };
  const footnote = { top: footer.top - px(s.footnoteGap + s.footnote, k), height: px(s.footnote, k) };
  return { ...base, footer, footnote };
}

export interface SpotlightGeometry extends PlayerFrame {
  name: Band;
  fact: Band | null;
  hero: Band | null;
  rows: Band | null;
  /** Tipografik yedekte dev adın alanı (fotoğrafın yerine). */
  title: Band;
  /** Fotoğraf hattının okuduğu geometri (yazısız bölge, gradyan). */
  photo: ResultGeometry;
}

export const spotlightRowLines = (rows: number) => Math.ceil(rows / 2);

export function spotlightGeometry(frame: MatchDayFrame, card: Pick<SpotlightCard, "hero" | "rows" | "fact">, side: ColumnSide = "right"): SpotlightGeometry {
  const g = withFooter(frameBoxes(frame, side));
  const { k } = g;
  const s = PLAYER_SIZES;
  let y = g.footnote.top - px(s.gap, k);
  const take = (height: number): Band => {
    const band = { top: y - height, height };
    y = band.top - px(s.gap, k);
    return band;
  };
  const rows = card.rows.length > 0 ? take(spotlightRowLines(card.rows.length) * px(s.rowHeight, k)) : null;
  const hero = card.hero.length > 0 ? take(px(s.heroValue + s.heroLabelGap + s.heroLabel, k)) : null;
  const fact = card.fact ? take(px(s.fact, k)) : null;
  const name = { top: y + px(s.gap, k) - px(s.ratingGap, k) - px(s.rating, k), height: px(s.rating, k) };
  const titleBottom = name.top - px(40, k);
  const title = { top: g.panel.top, height: Math.max(0, titleBottom - g.panel.top) };
  return { ...g, name, fact, hero, rows, title, photo: photoGeometry(g, name.top) };
}

/** Fotoğraf hattı için `ResultGeometry`: gradyan yazı bloğunun hemen üstünde tam koyulaşır. */
function photoGeometry(g: PlayerFrame, textTop: number): ResultGeometry {
  const { frame, k } = g;
  if (frame.orientation === "landscape") {
    const columnEdge = g.side === "right" ? g.panel.left : frame.width - g.panel.right;
    const shadeSolid = columnEdge - 24;
    const shadeStart = shadeSolid - 200;
    const edge = shadeStart + 40;
    const photoSafe = g.side === "right" ? { left: SAFE_MARGIN, right: edge, top: SAFE_MARGIN + 40, bottom: frame.height - SAFE_MARGIN } : { left: frame.width - edge, right: frame.width - SAFE_MARGIN, top: SAFE_MARGIN + 40, bottom: frame.height - SAFE_MARGIN };
    return { frame, k: 1, ...g.box, side: g.side, column: g.panel, shadeStart, shadeSolid, photoSafe, titleBand: null };
  }
  const shadeSolid = textTop - px(30, k);
  const shadeStart = Math.max(g.box.top + px(80, k), shadeSolid - px(240, k));
  return { frame, k, ...g.box, side: "right", column: null, shadeStart, shadeSolid, photoSafe: { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: g.box.top + px(40, k), bottom: shadeStart }, titleBand: null };
}

export interface TopPlayersGeometry extends PlayerFrame {
  title: Band;
  rowsArea: Band;
  rowHeight: number;
}

export function topPlayersGeometry(frame: MatchDayFrame, card: Pick<TopPlayersCard, "rows">): TopPlayersGeometry {
  const g = withFooter(frameBoxes(frame, "right"));
  const landscape = frame.orientation === "landscape";
  // 16:9: liste tam genişlik (fotoğraf yok), başlık sol üstte.
  const panel = landscape ? { ...g.box, top: g.box.top + LANDSCAPE_HEADER } : g.panel;
  const base = landscape ? withFooter({ ...g, panel }) : g;
  const { k } = base;
  const s = PLAYER_SIZES;
  const title = { top: panel.top, height: px(s.title, k) };
  const top = title.top + title.height + px(s.titleGap, k);
  const bottom = base.footnote.top - px(s.gap, k);
  const rowHeight = Math.min(px(220, k), Math.floor((bottom - top) / Math.max(1, card.rows.length)));
  // Az satırda (3) liste alanın ortasında — altta boşluk birikmez.
  const height = rowHeight * card.rows.length;
  return { ...base, title, rowsArea: { top: top + Math.floor((bottom - top - height) / 2), height }, rowHeight };
}
