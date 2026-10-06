"use client";

import type { TeamDataSummary } from "@/app/dashboard/studio/market-analysis/actions";
import { cn } from "@/lib/utils";

const FORM_LETTERS = { W: { letter: "G", className: "bg-emerald-600" }, D: { letter: "B", className: "bg-zinc-600" }, L: { letter: "M", className: "bg-red-700" } } as const;

function fmt(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}

/** Önerilerin dayandığı ham veri — admin neyi düzenlediğini bilsin. */
export function DataSummary({ summary }: { summary: TeamDataSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        {summary.last5.map((letter, index) => {
          const meta = FORM_LETTERS[letter as keyof typeof FORM_LETTERS];
          return (
            <span key={index} className={cn("flex size-5 items-center justify-center rounded text-[10px] font-bold text-white", meta?.className)}>
              {meta?.letter ?? "?"}
            </span>
          );
        })}
      </span>
      <span>Gol {fmt(summary.goalsForAvg)} / {fmt(summary.goalsAgainstAvg)}</span>
      <span>xG {fmt(summary.xgForAvg, 2)} / {fmt(summary.xgAgainstAvg, 2)}</span>
      {summary.formation ? <span>Diziliş {summary.formation}</span> : null}
      <span className="ml-auto tabular-nums">
        {summary.matchesSampled} maç · {summary.statMatchesSampled} istatistikli
      </span>
    </div>
  );
}
