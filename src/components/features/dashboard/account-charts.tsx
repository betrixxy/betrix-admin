"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FollowerPoint, ReachPoint } from "@/lib/dashboard/account-data";

const GRID = "rgba(255,255,255,0.08)";
const AXIS = "#8b8b93";
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

function Empty({ text }: { text: string }) {
  return <p className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">{text}</p>;
}

/** Hesap geneli: takipçi büyümesi (platform başına) ve son 30 günün günlük erişimi (Instagram). */
export function AccountCharts({ followers, reach }: { followers: FollowerPoint[]; reach: ReachPoint[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Takipçi büyümesi</CardTitle>
          <CardDescription>Günlük hesap kaydından (son 90 gün) — her gün otomatik kaydedilir</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {followers.length === 0 ? (
              <Empty text="Henüz günlük hesap kaydı yok — ilk kayıt hesap bağlandıktan sonraki saatlik tetiklemede alınır." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={followers.map((point) => ({ ...point, label: shortDay(point.day) }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis yAxisId="ig" stroke="#f472b6" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} domain={["auto", "auto"]} />
                  <YAxis yAxisId="x" orientation="right" stroke="#e5e7eb" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="ig" isAnimationActive={false} type="monotone" dataKey="instagram" name="Instagram" stroke="#f472b6" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="x" isAnimationActive={false} type="monotone" dataKey="x" name="X" stroke="#e5e7eb" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Günlük erişim — son 30 gün</CardTitle>
          <CardDescription>Instagram hesap erişimi ve görüntülenme (X API hesap düzeyinde erişim vermez)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {reach.length === 0 ? (
              <Empty text="Henüz günlük Instagram kaydı yok." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reach.map((point) => ({ ...point, label: shortDay(point.day) }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar isAnimationActive={false} dataKey="reach" name="Erişim" fill="#818cf8" radius={[3, 3, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="views" name="Görüntülenme" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
