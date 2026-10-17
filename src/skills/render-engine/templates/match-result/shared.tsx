import type { ResultGeometry } from "./geometry";

/**
 * Maç Sonucu'na özgü yapı taşları (Satori). Skor şeridi, golcüler, sayfa etiketi ve künye set
 * kartlarıyla ortaktır — `../checkmatch-set/set-parts.tsx`.
 */

const SHADE_RGB = "7,8,12";

/** Kartın alt (yatayda sağ) bölgesini koyulaştıran gradyan — z-data-layer'ın okunabilirlik paneli. */
export function Shade({ g }: { g: ResultGeometry }) {
  const { width, height, orientation } = g.frame;
  const vertical = orientation === "vertical";
  const span = vertical ? height : width;
  const start = (g.shadeStart / span) * 100;
  const solid = (g.shadeSolid / span) * 100;
  return (
    <div
      tw="absolute flex"
      style={{
        left: 0,
        top: 0,
        width,
        height,
        backgroundImage: `linear-gradient(${vertical ? "to bottom" : "to right"}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},0.78) ${(start + solid) / 2}%, rgba(${SHADE_RGB},0.94) ${solid}%, rgba(${SHADE_RGB},0.97) 100%)`,
      }}
    />
  );
}
