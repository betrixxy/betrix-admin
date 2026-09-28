import { format, parseISO, startOfWeek } from "date-fns";
import { tr } from "date-fns/locale";
import type { TrafficGranularity, TrafficSeriesPoint } from "@/types/traffic";

/** Trafik gün sınırları Türkiye saatine göre çizilir. */
export const TRAFFIC_TIME_ZONE = "Europe/Istanbul";
/** Türkiye'de yaz saati uygulaması yoktur (2016'dan beri sabit UTC+3). */
const TRAFFIC_UTC_OFFSET = "+03:00";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TRAFFIC_TIME_ZONE });

/** `yyyy-MM-dd` — verilen anın Türkiye takvimindeki günü. */
export function dayKeyOf(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** Bugün dahil son `days` günün anahtarları, eskiden yeniye. */
export function lastDayKeys(days: number, now: Date = new Date()): string[] {
  return Array.from({ length: days }, (_, index) =>
    dayKeyOf(new Date(now.getTime() - (days - 1 - index) * DAY_MS)),
  );
}

/** Verilen gün anahtarının Türkiye saatiyle 00:00 anı. */
export function startOfDayKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00${TRAFFIC_UTC_OFFSET}`);
}

export interface DailyCounts {
  visits: number;
  uniques: number;
}

/** Kaydı olmayan günler 0 ile doldurulur, böylece grafikte boşluk kalmaz. */
export function buildDailySeries(
  dayKeys: string[],
  counts: Map<string, DailyCounts>,
): TrafficSeriesPoint[] {
  return dayKeys.map((key) => ({
    key,
    label: format(parseISO(key), "d MMM", { locale: tr }),
    visits: counts.get(key)?.visits ?? 0,
    uniques: counts.get(key)?.uniques ?? 0,
  }));
}

/** Günlük seriyi pazartesi başlangıçlı haftalara toplar. */
export function aggregateWeekly(daily: TrafficSeriesPoint[]): TrafficSeriesPoint[] {
  const weeks = new Map<string, TrafficSeriesPoint>();

  for (const point of daily) {
    const weekStart = startOfWeek(parseISO(point.key), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const existing = weeks.get(key);
    if (existing) {
      existing.visits += point.visits;
      existing.uniques += point.uniques;
    } else {
      weeks.set(key, {
        key,
        label: `${format(weekStart, "d MMM", { locale: tr })} haftası`,
        visits: point.visits,
        uniques: point.uniques,
      });
    }
  }

  return [...weeks.values()];
}

export function buildSeries(
  granularity: TrafficGranularity,
  daily: TrafficSeriesPoint[],
): TrafficSeriesPoint[] {
  return granularity === "week" ? aggregateWeekly(daily) : daily;
}

/** KVKK: IPv4'te son oktet, IPv6'da ilk üç grup dışındaki her şey gizlenir. */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 3).join(":")}:…`;
  }
  const octets = ip.split(".");
  return octets.length === 4 ? `${octets.slice(0, 3).join(".")}.xxx` : "gizli";
}
