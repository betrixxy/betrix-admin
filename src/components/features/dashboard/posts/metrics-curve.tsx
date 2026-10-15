"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Gönderi metriklerinin yayından sonraki eğrisi (1 sa → 30 g) — kitle ve etkileşim ayrı ölçeklerde. */

export interface CurvePoint {
  label: string;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

const GRID = "rgba(255,255,255,0.08)";
const AXIS = "#8b8b93";
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const AUDIENCE = [
  { key: "reach", name: "Erişim", color: "#818cf8" },
  { key: "views", name: "Gösterim / izlenme", color: "#38bdf8" },
] as const;
const ENGAGEMENT = [
  { key: "likes", name: "Beğeni", color: "#f472b6" },
  { key: "comments", name: "Yorum", color: "#22d3ee" },
  { key: "shares", name: "Paylaşım", color: "#34d399" },
  { key: "saves", name: "Kaydetme", color: "#fbbf24" },
] as const;

function Chart({ points, series }: { points: CurvePoint[]; series: readonly { key: keyof CurvePoint; name: string; color: string }[] }) {
  const visible = series.filter((line) => points.some((point) => point[line.key] !== null));
  if (visible.length === 0) return <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Bu platform bu metrikleri vermiyor.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {visible.map((line) => (
          <Line key={line.key} isAnimationActive={false} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MetricsCurve({ points }: { points: CurvePoint[] }) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Henüz metrik çekilmedi — ilk ölçüm yayından 1 saat sonra otomatik alınır.</p>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-64">
        <Chart points={points} series={AUDIENCE} />
      </div>
      <div className="h-64">
        <Chart points={points} series={ENGAGEMENT} />
      </div>
    </div>
  );
}
