import { fullDate, shortDate } from "@/lib/format/dates";
import { addDays, istanbulDay, istanbulDayBounds, istanbulWeekday } from "@/lib/metrics/istanbul-time";
import { seasonLabel } from "@/lib/player-h2h/names";
import type { PeriodKind, ScorecardPeriod } from "@/types/prediction-scorecard";

/**
 * B · dönem karnesinin sınırları (saf) — İstanbul günleriyle; bir tahmin MAÇIN BAŞLAMA ANINA göre döneme
 * girer (onay anına değil). Hafta: Pazartesi 00:00 – sonraki Pazartesi 00:00. Ay: takvim ayı. Sezon: 1
 * Temmuz – sonraki 1 Temmuz (karne birden çok ligi kapsar; Avrupa liglerinin ortak sezon aralığı, etiket
 * "2026/27"). Başlangıç dahil, bitiş hariç.
 */

const monthFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", month: "long", year: "numeric" });

/** Ayın ilk günü ("2026-10-30" → "2026-10-01") ve sonraki ayın ilk günü. */
function monthBounds(day: string): [string, string] {
  const [year, month] = day.split("-").map(Number) as [number, number];
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return [first, next];
}

/** Sezonun başladığı yıl: Temmuz ve sonrası o yıl, öncesi bir önceki yıl. */
export function seasonStartYear(day: string): number {
  const [year, month] = day.split("-").map(Number) as [number, number];
  return month >= 7 ? year : year - 1;
}

function bounds(kind: PeriodKind, day: string): [string, string] {
  switch (kind) {
    case "WEEK": {
      const monday = addDays(day, 1 - istanbulWeekday(istanbulDayBounds(day).start));
      return [monday, addDays(monday, 7)];
    }
    case "MONTH":
      return monthBounds(day);
    case "SEASON": {
      const year = seasonStartYear(day);
      return [`${year}-07-01`, `${year + 1}-07-01`];
    }
  }
}

function label(kind: PeriodKind, first: string, next: string): string {
  switch (kind) {
    case "WEEK":
      return `${shortDate(first)} – ${fullDate(addDays(next, -1))}`;
    case "MONTH":
      return monthFormat.format(istanbulDayBounds(first).start).toLocaleUpperCase("tr-TR");
    case "SEASON":
      return `${seasonLabel(seasonStartYear(first))} SEZONU`;
  }
}

/** `at` anını içeren dönem (hafta / ay / sezon). */
export function periodFor(kind: PeriodKind, at: Date): ScorecardPeriod {
  const [first, next] = bounds(kind, istanbulDay(at));
  return { kind, start: istanbulDayBounds(first).start.toISOString(), end: istanbulDayBounds(next).start.toISOString(), label: label(kind, first, next) };
}

/** Başlama anı dönemin içinde mi (başlangıç dahil, bitiş hariç)? */
export function inPeriod(period: Pick<ScorecardPeriod, "start" | "end">, kickoffUtc: string): boolean {
  const at = new Date(kickoffUtc).getTime();
  return at >= new Date(period.start).getTime() && at < new Date(period.end).getTime();
}
