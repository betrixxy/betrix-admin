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

const PUBLISH_AT_PARTS = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Planlanan yayın zamanı, İstanbul saatiyle — "09 Eki 19:00". */
export function formatPublishAt(publishAtUtc: string): string {
  const parts = Object.fromEntries(PUBLISH_AT_PARTS.formatToParts(new Date(publishAtUtc)).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.hour}:${parts.minute}`;
}
