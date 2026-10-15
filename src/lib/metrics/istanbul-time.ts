/**
 * İstanbul saat dilimi yardımcıları — saf fonksiyonlar. Türkiye 2016'dan beri sabit UTC+3'tür (yaz saati
 * yok); yine de biçimlendirme `Intl` ile yapılır ki kural değişirse tek yer burası olsun.
 */

export const ISTANBUL_TZ = "Europe/Istanbul";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: ISTANBUL_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: ISTANBUL_TZ, hour: "2-digit", hourCycle: "h23" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: ISTANBUL_TZ, weekday: "short" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** İstanbul günü — `YYYY-MM-DD`. */
export function istanbulDay(at: Date): string {
  return dayFormat.format(at);
}

/** 0–23 */
export function istanbulHour(at: Date): number {
  return Number(hourFormat.format(at)) % 24;
}

/** ISO hafta günü: 1 = Pazartesi … 7 = Pazar. */
export function istanbulWeekday(at: Date): number {
  return WEEKDAYS.indexOf(weekdayFormat.format(at)) + 1;
}

/** İstanbul gününün UTC başlangıcı (dahil) ve sonu (hariç). */
export function istanbulDayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** `day`'den `offset` gün sonrası (negatif = önce). */
export function addDays(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Prisma `@db.Date` alanına yazılacak tarih (UTC gece yarısı). */
export function dayToDbDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}
