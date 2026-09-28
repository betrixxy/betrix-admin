"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MatchChip } from "@/components/features/calendar/match-chip";
import { formatDayNumber } from "@/lib/calendar/format";
import type { CalendarFixture } from "@/types/calendar";

const MAX_VISIBLE_CHIPS = 3;

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  fixtures: CalendarFixture[];
  onSelect: (fixtureId: string) => void;
}

/** Gerçek bir maç gününde onlarca karşılaşma olabilir — "+N daha" hücreyi genişletir. */
export function DayCell({ date, isCurrentMonth, isToday, fixtures, onSelect }: DayCellProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? fixtures : fixtures.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = fixtures.length - visible.length;

  return (
    <div className="flex min-h-[104px] flex-col gap-1 px-1.5 py-1.5">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-xs",
          isToday
            ? "bg-foreground font-semibold text-background"
            : isCurrentMonth
              ? "text-foreground/70"
              : "text-muted-foreground/30",
        )}
      >
        {formatDayNumber(date)}
      </span>
      <div className="flex flex-col gap-0.5">
        {visible.map((fixture) => (
          <MatchChip
            key={fixture.id}
            fixture={fixture}
            muted={!isCurrentMonth}
            onSelect={onSelect}
          />
        ))}
        {overflow > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="w-fit rounded px-1.5 text-left text-[10px] text-muted-foreground/70 hover:text-white"
          >
            {expanded ? "Daralt" : `+${overflow} daha`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
