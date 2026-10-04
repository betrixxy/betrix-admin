"use client";

import { cn } from "@/lib/utils";
import { ProductionBar } from "@/components/features/calendar/production-bar";
import { TeamLogo } from "@/components/features/calendar/team-logo";
import { totalAdSpend } from "@/lib/calendar/ad-spend";
import { summarizeProduction } from "@/lib/calendar/content-progress";
import type { CalendarFixture } from "@/types/calendar";

interface MatchChipProps {
  fixture: CalendarFixture;
  muted?: boolean;
  onSelect: (fixtureId: string) => void;
}

/**
 * Takvim hücresindeki sade maç kartı: yalnızca maç adı + altında içerik paketi ilerlemesi
 * ("2/12"). Saat, durum ve ayrıntılar tıklanınca açılan kontrol merkezindedir.
 */
export function MatchChip({ fixture, muted = false, onSelect }: MatchChipProps) {
  const summary = summarizeProduction(fixture.production);
  const hasBudget = fixture.contentPlan ? totalAdSpend(fixture.contentPlan.adSpend) > 0 : false;

  return (
    <button
      type="button"
      onClick={() => onSelect(fixture.id)}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.06]",
        muted && "opacity-40",
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <TeamLogo logoUrl={fixture.homeTeam.logoUrl} teamName={fixture.homeTeam.name} size={14} />
        <span className="truncate text-[11px] font-medium text-foreground/90">
          {fixture.homeTeam.shortName}-{fixture.awayTeam.shortName}
        </span>
        {hasBudget ? (
          <span className="ml-auto shrink-0 text-[10px] font-semibold text-amber-300" title="Reklam bütçesi girildi">
            ₺
          </span>
        ) : null}
      </span>
      <span className="flex w-full items-center gap-1.5" title={`${summary.approved}/${summary.total} içerik hazır · ${summary.draft} onay bekliyor`}>
        <ProductionBar summary={summary} className="flex-1" />
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
          {summary.approved}/{summary.total}
        </span>
      </span>
    </button>
  );
}
