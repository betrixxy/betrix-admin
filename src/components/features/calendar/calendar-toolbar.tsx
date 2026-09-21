"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CONTENT_STATUS_META, CONTENT_STATUS_ORDER } from "@/lib/calendar/content-status";
import { formatMonthTitle } from "@/lib/calendar/format";

interface CalendarToolbarProps {
  month: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export function CalendarToolbar({
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-[9rem] text-lg font-semibold text-foreground">
          {formatMonthTitle(month)}
        </h2>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" onClick={onPrevMonth} aria-label="Önceki ay" />
              }
            >
              <ChevronLeft className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Önceki ay</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" onClick={onNextMonth} aria-label="Sonraki ay" />
              }
            >
              <ChevronRight className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Sonraki ay</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="sm" onClick={onToday} className="ml-1 text-xs" />}
            >
              Bugün
            </TooltipTrigger>
            <TooltipContent>Bugünün olduğu aya dön</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {CONTENT_STATUS_ORDER.map((status) => {
          const meta = CONTENT_STATUS_META[status];
          return (
            <span
              key={status}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className={cn("size-1.5 rounded-full", meta.dotClassName)} aria-hidden />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
