import { useMemo } from "react";
import { dotOrder } from "../lib/motion";

export interface DotGridProps {
  /** Görünen nokta sayısı kadar sırayla boyanır. */
  segments: readonly { color: string; lit: number }[];
  columns?: number;
  rows?: number;
  size: number;
  seed?: number;
  idleColor?: string;
  /** "blocks": sütun sütun soldan sağa dolar, oranlar bloklar hâlinde okunur. "scatter": ızgaraya serpilir. */
  fill?: "blocks" | "scatter";
}

/**
 * Nokta ızgarası: 1 nokta = 500 simülasyon, toplam 1000. Oran gösteren sahnede segmentler soldan sağa kendi
 * bloğunda dolar; sayaç sahnesinde tekrarlanabilir biçimde serpilir.
 */
export function DotGrid({ segments, columns = 40, rows = 25, size, seed = 7, idleColor = "rgba(255,255,255,0.10)", fill = "scatter" }: DotGridProps) {
  const total = columns * rows;
  const gap = size / columns;
  const radius = gap * 0.34;
  const order = useMemo(() => {
    if (fill === "scatter") return dotOrder(total, seed);
    return Array.from({ length: columns }, (_, column) => Array.from({ length: rows }, (_, row) => row * columns + column)).flat();
  }, [fill, columns, rows, total, seed]);
  const colors = new Array<string>(total).fill(idleColor);
  let cursor = 0;
  for (const segment of segments) {
    for (let index = 0; index < segment.lit && cursor + index < total; index += 1) colors[order[cursor + index] as number] = segment.color;
    cursor += segment.lit;
  }
  return (
    <svg width={size} height={rows * gap} viewBox={`0 0 ${size} ${rows * gap}`} style={{ display: "block" }}>
      {colors.map((color, index) => (
        <circle key={index} cx={(index % columns) * gap + gap / 2} cy={Math.floor(index / columns) * gap + gap / 2} r={radius} fill={color} />
      ))}
    </svg>
  );
}
