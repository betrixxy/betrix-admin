import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { labelStyle, type Theme } from "./tokens";

/**
 * Taktik tahtası öğeleri: saha çizgileri, tebeşir ok, mıknatıs pul, el yazısı etiket. D temasının analiz kartlarında kullanılır.
 * El yazısı yalnız `HandLabel` ile ve en fazla 3 sözcük, rakamsız: cümle ve rakam el yazısına girmez, denetim render'ı durdurur.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CHALK = "#F4F6EF";
export const BOARD_GROUND = "#0D2118";

/** Tebeşir pürüzü: her SVG kendi filtresini taşır, geçiş sırasında kaybolmaz. */
const ChalkFilter = ({ id }: { id: string }) => (
  <defs>
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
    </filter>
  </defs>
);

/** Tahta paneli: koyu yeşil zemin + yatay saha çizgileri. İçerik mutlak konumlanır; ölçüler çağırandan. */
export function BoardPanel({ name, width, height, grow = false, lines = true, children, style }: { name: string; width: number; height: number; grow?: boolean; lines?: boolean; children?: ReactNode; style?: CSSProperties }) {
  const chalk = { fill: "none", stroke: CHALK, strokeOpacity: 0.3, strokeWidth: 4, filter: `url(#chalk-${name})` } as const;
  return (
    <div data-block={name} style={{ position: "relative", width, minHeight: height, flex: grow ? 1 : undefined, flexShrink: 0, background: BOARD_GROUND, border: `4px solid ${CHALK}66`, overflow: "hidden", ...style }}>
      {lines ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
          <ChalkFilter id={`chalk-${name}`} />
          <line x1={width / 2} y1={8} x2={width / 2} y2={height - 8} {...chalk} />
          <circle cx={width / 2} cy={height / 2} r={Math.min(height / 4, 70)} {...chalk} />
          <rect x={-6} y={height * 0.2} width={width * 0.16} height={height * 0.6} {...chalk} />
          <rect x={width - width * 0.16 + 6} y={height * 0.2} width={width * 0.16} height={height * 0.6} {...chalk} />
        </svg>
      ) : null}
      {children}
    </div>
  );
}

/** Kendini çizen tebeşir ok. Koordinatlar panelin içinde. */
export function ChalkArrow({ width, height, from, to, bend = 0, color = CHALK, start = 24, name = "ok" }: { width: number; height: number; from: readonly [number, number]; to: readonly [number, number]; bend?: number; color?: string; start?: number; name?: string }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [start, start + 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const [mx, my] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + bend];
  const angle = Math.atan2(to[1] - my, to[0] - mx);
  const head = (offset: number) => `${to[0] - 30 * Math.cos(angle + offset)},${to[1] - 30 * Math.sin(angle + offset)}`;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.3;
  return (
    <svg data-fill="" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <ChalkFilter id={`chalk-${name}`} />
      <path d={`M ${from[0]} ${from[1]} Q ${mx} ${my} ${to[0]} ${to[1]}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - progress)} filter={`url(#chalk-${name})`} />
      {progress > 0.9 ? <polyline points={`${head(0.5)} ${to[0]},${to[1]} ${head(-0.5)}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" filter={`url(#chalk-${name})`} /> : null}
    </svg>
  );
}

/** Mıknatıs pul: takım rengi, beyaz kenar, gölge. Armalı olursa içinde logo. Adı yazılmaz: veride yalnız diziliş var. */
export function Magnet({ x, y, r, color, logo = null, show = 1 }: { x: number; y: number; r: number; color: string; logo?: string | null; show?: number }) {
  return (
    <g opacity={show}>
      <circle cx={x + 3} cy={y + 5} r={r} fill="rgba(0,0,0,0.45)" />
      <circle cx={x} cy={y} r={r} fill={logo ? "#F4F6EF" : color} stroke={logo ? color : "#F4F6EF"} strokeWidth={Math.max(4, r * 0.14)} />
      {logo ? <image href={staticFile(logo)} x={x - r * 0.68} y={y - r * 0.68} width={r * 1.36} height={r * 1.36} /> : <circle cx={x - r * 0.28} cy={y - r * 0.3} r={r * 0.2} fill="rgba(255,255,255,0.35)" />}
    </g>
  );
}

/** Kısa el yazısı vurgu. Denetim: en fazla 3 sözcük, rakam yok. */
export function HandLabel({ theme, text, size = 58, rotate = -3, color, style }: { theme: Theme; text: string; size?: number; rotate?: number; color?: string; style?: CSSProperties }) {
  return <div data-hand="" style={{ position: "absolute", fontFamily: theme.hand ?? theme.label, fontSize: size, lineHeight: 1, color: color ?? theme.accentText, whiteSpace: "nowrap", transform: `rotate(${rotate}deg)`, ...style }}>{text}</div>;
}

export const boardLabel = (theme: Theme, size: number): CSSProperties => ({ ...labelStyle(theme, size), color: CHALK, whiteSpace: "nowrap" });
