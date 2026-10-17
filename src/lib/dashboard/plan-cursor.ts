import { MATCH_CENTER_PAST_DAYS } from "@/lib/dashboard/match-center-window";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";

/** İçerik Planı gün imleci — saf (`yyyy-MM-dd`, İstanbul günü). */

/** Listenin en erken günü: dün (Maç Merkezi ile aynı pencere). */
export function planStartDay(now: Date): string {
  return addDays(istanbulDay(now), -MATCH_CENTER_PAST_DAYS);
}

/** Geçerli imleç: `yyyy-MM-dd` ve en erken günden önce değil; değilse null. */
export function parsePlanCursor(value: unknown, now: Date): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value < planStartDay(now) ? null : value;
}
