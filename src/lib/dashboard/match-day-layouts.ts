import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { matchDayGeometry, type PlayerSlot, type TemplateGeometry } from "@/skills/render-engine/templates/match-day/geometry";
import type { MatchDayTemplateId } from "@/types/match-day";

export type { PlayerSlot };

/**
 * Şablon × format başına piksel katmanı: oyuncu yerleşimi (geometri modülünden — tipografiyle
 * aynı kaynak), okunabilirlik gölgesi ve oyuncu arkasındaki ışık. Işık gerçekçi tutulur: takım
 * rengi yalnızca hafif bir arka aydınlatma olarak, parlama/neon etkisi yaratmayacak düşük
 * yoğunlukta kullanılır.
 */

export interface MatchDayLayout {
  home: PlayerSlot;
  away: PlayerSlot;
  shadeSvg: string;
  /** `team`: takım rengi, `white`: stüdyo arka ışığı, `null`: ışık yok. */
  backlight: { tint: "team" | "white"; alpha: number } | null;
}

const NAVY = "#020617";

function svg(frame: MatchDayFrame, defs: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><defs>${defs}</defs>${body}</svg>`;
}

/** Dikey geçiş: [konum (0-1), opaklık] durakları. */
function fade(id: string, stops: [number, number][], horizontal = false): string {
  const dir = horizontal ? `x1="0" y1="0" x2="1" y2="0"` : `x1="0" y1="0" x2="0" y2="1"`;
  return `<linearGradient id="${id}" ${dir}>${stops
    .map(([offset, opacity]) => `<stop offset="${Math.min(1, Math.max(0, offset)).toFixed(3)}" stop-color="${NAVY}" stop-opacity="${opacity}"/>`)
    .join("")}</linearGradient>`;
}

const VIGNETTE = `<radialGradient id="vig" cx="0.5" cy="0.42" r="0.78">
  <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/>
</radialGradient>`;

const fill = (id: string) => `<rect width="100%" height="100%" fill="url(#${id})"/>`;

function shade(template: MatchDayTemplateId, g: TemplateGeometry): string {
  const { frame } = g;
  const H = frame.height;
  if (frame.orientation === "landscape") {
    // Metin kolonu tarafı koyulaşır: yayın/veri şablonunda sol, editoryalde sağ.
    const textLeft = template !== "EDITORIAL_PORTRAIT";
    const stops: [number, number][] = textLeft
      ? [[0, 0.94], [0.36, 0.86], [0.55, 0]]
      : [[0.45, 0], [0.62, 0.86], [1, 0.94]];
    return svg(frame, VIGNETTE + fade("side", stops, true), fill("vig") + fill("side"));
  }
  const block = g.blockTop / H;
  const top = (g.top + 140 * g.k) / H;
  if (template === "DATA_DRIVEN") {
    return svg(
      frame,
      fade("left", [[0, 0.92], [0.42, 0.82], [0.62, 0]], true) + fade("bottom", [[block - 0.08, 0], [block, 0.9], [1, 0.97]]),
      `<rect width="100%" height="100%" fill="${NAVY}" fill-opacity="0.25"/>` + fill("left") + fill("bottom"),
    );
  }
  return svg(
    frame,
    VIGNETTE + fade("top", [[0, 0.82], [top, 0]]) + fade("bottom", [[block - 0.12, 0], [block + 0.06, 0.78], [1, 0.97]]),
    fill("vig") + fill("top") + fill("bottom"),
  );
}

const BACKLIGHT: Record<MatchDayTemplateId, MatchDayLayout["backlight"]> = {
  PREMIUM_BROADCAST: { tint: "team", alpha: 0.42 },
  DATA_DRIVEN: null,
  EDITORIAL_PORTRAIT: { tint: "white", alpha: 0.22 },
};

export function getMatchDayLayout(template: MatchDayTemplateId, frame: MatchDayFrame): MatchDayLayout {
  const g = matchDayGeometry(template, frame);
  return { home: g.home, away: g.away, shadeSvg: shade(template, g), backlight: BACKLIGHT[template] };
}
