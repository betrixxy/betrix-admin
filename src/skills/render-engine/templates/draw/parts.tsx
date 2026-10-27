import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY, fitFontSize, px } from "../match-day/shared";
import { DRAW_SIZES, type DrawListGeometry, type DrawPosterGeometry } from "./geometry";

/**
 * Kura kartının ortak yapı taşları. Panel/kutu yok; hiyerarşi tipografi ve boşlukla. Turnuva logosu
 * hiçbir yerde yok (yalnızca künyede tipografik ad).
 */

export const SHADE_RGB = "7,8,12";
export const TEXT_SHADOW = "0 2px 14px rgba(0,0,0,0.6)";
export const MUTED = "rgba(255,255,255,0.66)";

/** "#ff6b00", 0.2 → "rgba(255,107,0,0.2)" */
export function alpha(hex: string, value: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${value})`;
}

/** Poster fotoğrafının üstündeki koyu gradyan (yazı bölgesi tam koyu). */
export function PosterShade({ g, only }: { g: DrawPosterGeometry; only: BlockFilter }) {
  if (only) return null;
  const { width, height } = g.frame;
  const span = g.shade.direction === "down" ? height : width;
  const start = (g.shade.start / span) * 100;
  const solid = (g.shade.solid / span) * 100;
  const direction = g.shade.direction === "down" ? "to bottom" : "to right";
  return (
    <div tw="absolute flex" style={{ left: 0, top: 0, width, height }}>
      <div tw="absolute flex" style={{ left: 0, top: 0, width, height, backgroundImage: `linear-gradient(${direction}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},0.8) ${(start + solid) / 2}%, rgba(${SHADE_RGB},1) ${solid}%, rgba(${SHADE_RGB},1) 100%)` }} />
      <div tw="absolute flex" style={{ left: 0, top: 0, width, height: px(220, g.k), backgroundImage: `linear-gradient(to bottom, rgba(${SHADE_RGB},0.6), rgba(${SHADE_RGB},0))` }} />
    </div>
  );
}

/** Liste sayfalarının başlığı: büyük başlık (Anton) + küçük aralıklı alt satır (vurgu renginde). */
export function ListTitle({ title, subtitle, accent, g, only }: { title: string; subtitle: string; accent: string; g: DrawListGeometry; only: BlockFilter }) {
  const s = DRAW_SIZES;
  const width = g.box.right - g.box.left;
  const size = fitFontSize(title, width, px(s.title, g.k), 0.47, px(36, g.k));
  const sub = fitFontSize(subtitle, width, px(s.subtitle, g.k), 0.82, px(12, g.k));
  return (
    <div tw="absolute flex flex-col" style={{ left: g.box.left, top: g.title.top, width, height: g.title.height, opacity: blockOpacity(only, "draw-hero") }}>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", marginTop: px(s.title, g.k) - size }}>{title}</span>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: sub, lineHeight: 1, letterSpacing: sub * 0.2, color: accent, marginTop: px(14, g.k) }}>{subtitle}</span>
    </div>
  );
}

/** Küçük, aralıklı büyük harf satır; `maxWidth` verilirse sığana kadar küçülür (Geist kalın ≈ 0,72 em + harf aralığı). */
export function Caps({ text, size, color = MUTED, weight = 700, spacing = 0.18, maxWidth }: { text: string; size: number; color?: string; weight?: number; spacing?: number; maxWidth?: number }) {
  const fitted = maxWidth ? fitFontSize(text, maxWidth, size, 0.72 + spacing, Math.round(size * 0.55)) : size;
  return <span style={{ fontFamily: BODY, fontWeight: weight, fontSize: fitted, lineHeight: 1, letterSpacing: fitted * spacing, color }}>{text}</span>;
}
