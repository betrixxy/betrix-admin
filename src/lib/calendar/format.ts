import { format } from "date-fns";
import { tr } from "date-fns/locale";

export function formatKickoffTime(kickoffUtc: string): string {
  return format(new Date(kickoffUtc), "HH:mm");
}

export function formatMatchDayLabel(kickoffUtc: string): string {
  return format(new Date(kickoffUtc), "d MMM, EEEE", { locale: tr });
}

export function formatShortDay(date: Date): string {
  return format(date, "EEEEEE", { locale: tr });
}

export function formatDayNumber(date: Date): string {
  return format(date, "d");
}

export function formatMonthTitle(date: Date): string {
  const label = format(date, "LLLL yyyy", { locale: tr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
