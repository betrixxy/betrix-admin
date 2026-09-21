"use client";

import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/features/calendar/team-logo";
import { CONTENT_STATUS_META } from "@/lib/calendar/content-status";
import { formatKickoffTime } from "@/lib/calendar/format";
import type { PlannedCalendarFixture } from "@/types/calendar";

interface MatchChipProps {
  fixture: PlannedCalendarFixture;
  muted?: boolean;
  onSelect: (fixtureId: string) => void;
}

export function MatchChip({ fixture, muted = false, onSelect }: MatchChipProps) {
  const statusDot = CONTENT_STATUS_META[fixture.contentStatus].dotClassName;

  return (
    <button
      type="button"
      onClick={() => onSelect(fixture.id)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.06]",
        muted && "opacity-40",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", statusDot)} aria-hidden />
      <TeamLogo logoUrl={fixture.homeTeam.logoUrl} teamName={fixture.homeTeam.name} size={16} />
      <span className="truncate text-[11px] font-medium text-foreground/90">
        {fixture.homeTeam.shortName}-{fixture.awayTeam.shortName}
      </span>
      <TeamLogo logoUrl={fixture.awayTeam.logoUrl} teamName={fixture.awayTeam.name} size={16} />
      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {formatKickoffTime(fixture.kickoffUtc)}
      </span>
    </button>
  );
}
