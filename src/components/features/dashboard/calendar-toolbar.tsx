import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarHref, resolveRange, shiftAnchor } from "@/lib/dashboard/calendar-range";
import { formatMonthTitle } from "@/lib/calendar/format";
import { cn } from "@/lib/utils";
import type { CalendarView } from "@/types/social";

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Ay",
  week: "Hafta",
  list: "Liste",
};

function periodTitle(view: CalendarView, anchor: Date): string {
  if (view === "week") {
    const { from, to } = resolveRange("week", anchor);
    return `${format(from, "d MMM", { locale: tr })} – ${format(to, "d MMM yyyy", { locale: tr })}`;
  }
  return formatMonthTitle(anchor);
}

const navLinkClass =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-white";

/** Görünüm seçici (Ay/Hafta/Liste) ve dönem gezinmesi — tamamı URL üzerinden, istemci durumu yok. */
export function CalendarToolbar({ view, anchor }: { view: CalendarView; anchor: Date }) {
  const showNavigation = view !== "list";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((option) => (
          <Link
            key={option}
            href={calendarHref({ view: option, anchor })}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              option === view ? "bg-card text-white shadow-sm" : "text-muted-foreground hover:text-white",
            )}
          >
            {VIEW_LABELS[option]}
          </Link>
        ))}
      </div>

      {showNavigation ? (
        <div className="flex items-center gap-1">
          <Link href={calendarHref({ view, anchor: shiftAnchor(view, anchor, -1) })} aria-label="Önceki dönem" className={navLinkClass}>
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-40 text-center text-sm font-medium text-white">{periodTitle(view, anchor)}</span>
          <Link href={calendarHref({ view, anchor: shiftAnchor(view, anchor, 1) })} aria-label="Sonraki dönem" className={navLinkClass}>
            <ChevronRight className="size-4" />
          </Link>
          <Link
            href={calendarHref({ view, anchor: new Date() })}
            className="ml-2 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-white"
          >
            Bugün
          </Link>
        </div>
      ) : null}
    </div>
  );
}
