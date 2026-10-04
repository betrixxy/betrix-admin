"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMonthTitle } from "@/lib/calendar/format";

const PRODUCTION_LEGEND = [
  { label: "Hazır (onaylı)", className: "bg-emerald-400" },
  { label: "Onay bekliyor", className: "bg-amber-400/80" },
  { label: "Üretilmedi", className: "bg-white/[0.08]" },
] as const;

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

      {/* Maç kartlarındaki içerik paketi çubuğunun açıklaması (bkz. production-bar.tsx). */}
      <div className="flex items-center gap-3">
        {PRODUCTION_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-1 w-3 rounded-full", item.className)} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
