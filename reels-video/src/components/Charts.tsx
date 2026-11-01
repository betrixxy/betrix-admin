import { COLORS } from "./Primitives";

/** Nokta ızgarası: 1 nokta = 500 simülasyon, toplam 1000. Segmentler soldan sağa kendi bloğunda dolar. */
export function DotGrid({ segments, size, columns = 50, rows = 20 }: { segments: readonly { color: string; lit: number }[]; size: number; columns?: number; rows?: number }) {
  const total = columns * rows;
  const gap = size / columns;
  const colors = new Array<string>(total).fill(COLORS.track);
  let cursor = 0;
  for (const segment of segments) {
    for (let index = 0; index < segment.lit && cursor + index < total; index += 1) {
      const position = cursor + index;
      colors[(position % rows) * columns + Math.floor(position / rows)] = segment.color;
    }
    cursor += segment.lit;
  }
  return (
    <svg width={size} height={rows * gap} viewBox={`0 0 ${size} ${rows * gap}`} style={{ display: "block" }}>
      {colors.map((color, index) => (
        <circle key={index} cx={(index % columns) * gap + gap / 2} cy={Math.floor(index / columns) * gap + gap / 2} r={gap * 0.36} fill={color} />
      ))}
    </svg>
  );
}

/** Yarım gauge. `value` 0–100; yuvarlanmış sayı gelir, dolgu sayaçla birlikte oturur. */
export function Gauge({ value, color, radius, stroke }: { value: number; color: string; radius: number; stroke: number }) {
  const margin = stroke / 2 + 2;
  const width = (radius + margin) * 2;
  const height = radius + margin + stroke / 2;
  const path = `M ${margin} ${radius + margin} A ${radius} ${radius} 0 0 1 ${radius * 2 + margin} ${radius + margin}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={COLORS.track} strokeWidth={stroke} strokeLinecap="round" />
      {value > 0 ? <path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDasharray={`${value} 100`} /> : null}
    </svg>
  );
}

/**
 * Saha: iki takım kendi kalesinden rakip kaleye koşan okla gösterilir, ok boyu olasılıkla orantılıdır. %46–%44 gibi
 * yakın değerlerde tek ok "açık fark" izlenimi vermez.
 */
export function PitchRace({ width, height, home, away, homeColor, awayColor, progress }: { width: number; height: number; home: number; away: number; homeColor: string; awayColor: string; progress: number }) {
  const line = { stroke: "rgba(255,255,255,0.3)", strokeWidth: 4, fill: "none" };
  const inner = width - 48;
  const arrow = (share: number, direction: 1 | -1, y: number, color: string) => {
    const length = (inner * share * progress) / 100;
    if (length < 4) return null;
    const startX = direction === 1 ? 24 : width - 24;
    const endX = startX + direction * length;
    const head = Math.min(44, length);
    return (
      <g>
        <line x1={startX} y1={y} x2={endX - direction * head * 0.6} y2={y} stroke={color} strokeWidth={26} />
        <polygon points={`${endX},${y} ${endX - direction * head},${y - 34} ${endX - direction * head},${y + 34}`} fill={color} />
      </g>
    );
  };
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <rect x={3} y={3} width={width - 6} height={height - 6} rx={20} fill={COLORS.surface} stroke={COLORS.border} strokeWidth={2} />
      <line x1={width / 2} y1={4} x2={width / 2} y2={height - 4} {...line} />
      <circle cx={width / 2} cy={height / 2} r={70} {...line} />
      <rect x={4} y={height / 2 - 130} width={112} height={260} {...line} />
      <rect x={width - 116} y={height / 2 - 130} width={112} height={260} {...line} />
      {arrow(home, 1, height * 0.32, homeColor)}
      {arrow(away, -1, height * 0.68, awayColor)}
    </svg>
  );
}
