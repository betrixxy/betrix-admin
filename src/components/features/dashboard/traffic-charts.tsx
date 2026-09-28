"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopPageItem, TrafficGranularity, TrafficSeriesPoint, TrafficSourceItem } from "@/types/traffic";

const COLORS = {
  visits: "#34d399",
  uniques: "#a78bfa",
  grid: "rgba(255,255,255,0.08)",
  axis: "#8b8b93",
} as const;

const SOURCE_COLORS = ["#34d399", "#f472b6", "#22d3ee", "#f87171", "#a1a1aa", "#60a5fa"];

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{message}</div>
  );
}

interface VisitorsChartProps {
  series: TrafficSeriesPoint[];
  granularity: TrafficGranularity;
}

export function VisitorsChart({ series, granularity }: VisitorsChartProps) {
  const hasVisits = series.some((point) => point.visits > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{granularity === "week" ? "Haftalık" : "Günlük"} Ziyaretçi</CardTitle>
        <CardDescription>Sayfa görüntüleme ve siteye ilk kez gelen (yeni) ziyaretçi sayısı</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {!hasVisits ? (
            <EmptyChart message="Bu dönemde ziyaret kaydı yok — izleme kodu checkmatch.net sitesine eklendiğinde veriler burada görünür." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.visits} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.visits} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="uniquesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.uniques} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS.uniques} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="label" stroke={COLORS.axis} fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis stroke={COLORS.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: COLORS.grid }} />
                <Area isAnimationActive={false} type="monotone" dataKey="visits" name="Ziyaret" stroke={COLORS.visits} strokeWidth={2} fill="url(#visitsFill)" />
                <Area isAnimationActive={false} type="monotone" dataKey="uniques" name="Yeni ziyaretçi" stroke={COLORS.uniques} strokeWidth={2} fill="url(#uniquesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: COLORS.visits }} />Ziyaret</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: COLORS.uniques }} />Yeni ziyaretçi</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function TopPagesChart({ pages }: { pages: TopPageItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>En Çok Girilen Sayfalar</CardTitle>
        <CardDescription>Seçili dönemdeki ziyaret sayısına göre</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {pages.length === 0 ? (
            <EmptyChart message="Bu dönemde ziyaret kaydı yok." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pages} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} horizontal={false} />
                <XAxis type="number" stroke={COLORS.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="path" width={150} stroke={COLORS.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar isAnimationActive={false} dataKey="visits" name="Ziyaret" fill={COLORS.visits} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TrafficSourcesChart({ sources }: { sources: TrafficSourceItem[] }) {
  const total = sources.reduce((sum, source) => sum + source.visits, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trafik Kaynakları</CardTitle>
        <CardDescription>Ziyaretçiler nereden geliyor (referans)</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-56">
            <EmptyChart message="Bu dönemde ziyaret kaydı yok." />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-56 w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Pie isAnimationActive={false} data={sources} dataKey="visits" nameKey="label" innerRadius="60%" outerRadius="90%" paddingAngle={2} stroke="none">
                    {sources.map((source, index) => (
                      <Cell key={source.key} fill={SOURCE_COLORS[index % SOURCE_COLORS.length] ?? COLORS.visits} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex w-full flex-col gap-2 sm:w-1/2">
              {sources.map((source, index) => (
                <li key={source.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-white">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                    />
                    {source.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {source.visits} · {Math.round((source.visits / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
