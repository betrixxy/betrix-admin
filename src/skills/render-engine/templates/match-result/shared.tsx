import type { ResultGeometry } from "./geometry";

/**
 * Maç Sonucu'na özgü yapı taşları (Satori). Skor şeridi, golcüler, sayfa etiketi ve künye set
 * kartlarıyla ortaktır — `../checkmatch-set/set-parts.tsx`.
 */

const SHADE_RGB = "7,8,12";

/**
 * Okunurluk gradyanının gücü (0..1) → başlangıç kayması (px) ve opaklıklar. Tam kadraj fotoğrafta
 * yazı bölgesinin ölçülen parlaklığından gelir (`match-photo/legibility.ts`); verilmezse kesim
 * modunun sabit gradyanı çizilir.
 */
export function shadeStops(strength: number | undefined): { lead: number; mid: number; solid: number; end: number } {
  if (strength === undefined) return { lead: 0, mid: 0.78, solid: 0.94, end: 0.97 };
  const s = Math.min(1, Math.max(0, strength));
  return { lead: Math.round(160 * s), mid: 0.5 + 0.34 * s, solid: 0.8 + 0.16 * s, end: 0.9 + 0.08 * s };
}

/** Kartın alt (yatayda sağ) bölgesini koyulaştıran gradyan — z-data-layer'ın okunabilirlik paneli. */
export function Shade({ g, strength }: { g: ResultGeometry; strength?: number | undefined }) {
  const { width, height, orientation } = g.frame;
  const vertical = orientation === "vertical";
  const span = vertical ? height : width;
  const stops = shadeStops(strength);
  const start = (Math.max(0, g.shadeStart - stops.lead * g.k) / span) * 100;
  const solid = (g.shadeSolid / span) * 100;
  return (
    <div
      tw="absolute flex"
      style={{
        left: 0,
        top: 0,
        width,
        height,
        backgroundImage: `linear-gradient(${vertical ? "to bottom" : "to right"}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},${stops.mid}) ${(start + solid) / 2}%, rgba(${SHADE_RGB},${stops.solid}) ${solid}%, rgba(${SHADE_RGB},${stops.end}) 100%)`,
      }}
    />
  );
}
