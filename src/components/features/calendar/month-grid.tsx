import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { DayCell } from "@/components/features/calendar/day-cell";
import { formatShortDay } from "@/lib/calendar/format";
import type { CalendarFixture } from "@/types/calendar";

const WEEKDAY_REFERENCE = eachDayOfInterval({
  start: startOfWeek(new Date(2026, 0, 1), { weekStartsOn: 1 }),
  end: endOfWeek(new Date(2026, 0, 1), { weekStartsOn: 1 }),
});

interface MonthGridProps {
  month: Date;
  /** Gerçek fikstürler — başlama saatine göre günlere yerleşir. */
  fixtures: CalendarFixture[];
  onSelect: (fixtureId: string) => void;
}

export function MonthGrid({ month, fixtures, onSelect }: MonthGridProps) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="grid grid-cols-7 border-b border-border/60">
        {WEEKDAY_REFERENCE.map((day) => (
          <div
            key={day.toISOString()}
            className="px-1.5 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60"
          >
            {formatShortDay(day)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
        {days.map((day) => {
          const dayFixtures = fixtures
            .filter((fixture) => isSameDay(new Date(fixture.kickoffUtc), day))
            .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

          return (
            <div key={day.toISOString()} className="border-r border-b border-border/40">
              <DayCell
                date={day}
                isCurrentMonth={isSameMonth(day, month)}
                isToday={isToday(day)}
                fixtures={dayFixtures}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
