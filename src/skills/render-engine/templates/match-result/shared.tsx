import type { MatchResultCard } from "@/types/match-result";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY } from "../match-day/shared";
import type { ResultGeometry } from "./geometry";

/**
 * Maç Sonucu'na özgü yapı taşları (Satori). Skor şeridi, golcüler, sayfa etiketi ve künye set
 * kartlarıyla ortaktır — `../checkmatch-set/`.
 */

/** Üç şablonun (A tam-kadraj · B dev-skor · C manşet) ortak girdisi. */
export interface ResultTemplateProps {
  card: MatchResultCard;
  g: ResultGeometry;
  /** Okunurluk gradyanının gücü (0..1) — yazı bölgesinin ölçülen parlaklığından. */
  shadeStrength: number;
  /** Yerleşim kontrolü: yalnızca bu blok görünür çizilir (bkz. `checkmatch-set/blocks.ts`). */
  only?: BlockFilter;
}

const SHADE_RGB = "7,8,12";

/**
 * Okunurluk gradyanının gücü (0..1) → başlangıç kayması (px) ve opaklıklar. Açık zeminde
 * gradyan erken başlar ve koyulaşır; koyu fotoğrafta hafif kalır (fotoğraf görünür).
 */
export function shadeStops(strength: number): { lead: number; mid: number; solid: number; end: number } {
  const s = Math.min(1, Math.max(0, strength));
  return { lead: Math.round(160 * s), mid: 0.5 + 0.34 * s, solid: 0.8 + 0.16 * s, end: 0.9 + 0.08 * s };
}

/** Kartın yazı bölgesini (dikeyde alt, yatayda set sütunu tarafı) koyulaştıran gradyan. */
export function Shade({ g, strength, only }: { g: ResultGeometry; strength: number; only?: BlockFilter }) {
  // Gradyan arka plandır — yerleşim kontrolünde ölçülmez.
  if (only) return null;
  const { width, height, orientation } = g.frame;
  const vertical = orientation === "vertical";
  const span = vertical ? height : width;
  const stops = shadeStops(strength);
  const start = (Math.max(0, g.shadeStart - stops.lead * g.k) / span) * 100;
  const solid = (g.shadeSolid / span) * 100;
  const direction = vertical ? "to bottom" : g.side === "left" ? "to left" : "to right";
  return (
    <div
      tw="absolute flex"
      style={{
        left: 0,
        top: 0,
        width,
        height,
        backgroundImage: `linear-gradient(${direction}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},${stops.mid}) ${(start + solid) / 2}%, rgba(${SHADE_RGB},${stops.solid}) ${solid}%, rgba(${SHADE_RGB},${stops.end}) 100%)`,
      }}
    />
  );
}

/** C · Manşet: üst başlık bandını koyulaştıran gradyan (üstte koyu → bandın altında şeffaf). */
export function TopShade({ g, strength, only }: { g: ResultGeometry; strength: number; only?: BlockFilter }) {
  if (!g.titleBand || only) return null;
  const stops = shadeStops(strength);
  const end = ((g.titleBand.bottom + 80 * g.k) / g.frame.height) * 100;
  return (
    <div
      tw="absolute flex"
      style={{
        left: 0,
        top: 0,
        width: g.frame.width,
        height: g.frame.height,
        backgroundImage: `linear-gradient(to bottom, rgba(${SHADE_RGB},${stops.solid}) 0%, rgba(${SHADE_RGB},${stops.mid}) ${end * 0.6}%, rgba(${SHADE_RGB},0) ${end}%)`,
      }}
    />
  );
}

/** "MAÇIN OYUNCUSU | AD" — kartta MVP adı yoksa (fotoğraf eşleşmiyor) hiç çizilmez. */
export function MvpLine({ card, size }: { card: MatchResultCard; size: number }) {
  if (!card.mvpName) return null;
  return (
    <div tw="flex items-center justify-center">
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.32, color: card.accentHex }}>MAÇIN OYUNCUSU</span>
      <div tw="flex" style={{ width: 2, height: size, backgroundColor: "rgba(255,255,255,0.35)", margin: `0 ${size * 0.8}px` }} />
      <span style={{ fontFamily: DISPLAY, fontSize: size * 1.5, lineHeight: 1, letterSpacing: 1, color: "white" }}>{card.mvpName}</span>
    </div>
  );
}
