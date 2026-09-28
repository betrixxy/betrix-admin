import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { CALENDAR_VIEWS, type CalendarView } from "@/types/social";

const DATE_FORMAT = "yyyy-MM-dd";
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export interface CalendarRange {
  view: CalendarView;
  anchor: Date;
  /** Görünümün ilk/son günü (ay görünümünde komşu aylara taşan hafta günleri dahil). */
  from: Date;
  to: Date;
}

export interface CalendarUrlState {
  view: CalendarView;
  anchor: Date;
  edit?: string | undefined;
}

export function parseView(param: string | string[] | undefined): CalendarView {
  return CALENDAR_VIEWS.find((view) => view === param) ?? "month";
}

export function parseAnchor(param: string | string[] | undefined): Date {
  if (typeof param === "string") {
    const parsed = parse(param, DATE_FORMAT, new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

export function resolveRange(view: CalendarView, anchor: Date): CalendarRange {
  if (view === "week") {
    return {
      view,
      anchor,
      from: startOfWeek(anchor, WEEK_OPTIONS),
      to: endOfWeek(anchor, WEEK_OPTIONS),
    };
  }
  return {
    view,
    anchor,
    from: startOfWeek(startOfMonth(anchor), WEEK_OPTIONS),
    to: endOfWeek(endOfMonth(anchor), WEEK_OPTIONS),
  };
}

/** Önceki/sonraki dönem: ay görünümünde ±1 ay, hafta görünümünde ±1 hafta. */
export function shiftAnchor(view: CalendarView, anchor: Date, direction: 1 | -1): Date {
  if (view === "week") return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
}

export function calendarHref({ view, anchor, edit }: CalendarUrlState): string {
  const params = new URLSearchParams({ view, date: format(anchor, DATE_FORMAT) });
  if (edit) params.set("edit", edit);
  return `/dashboard/calendar?${params.toString()}`;
}
