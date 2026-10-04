"use client";

import { isPast } from "date-fns";
import { CalendarClock, LayoutList, Megaphone, RadioTower } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AdSpendForm } from "@/components/features/calendar/ad-spend-form";
import { MarketCalculationsPanel } from "@/components/features/calendar/market-calculations-panel";
import { TeamLogo } from "@/components/features/calendar/team-logo";
import { FixtureContentChecklist } from "@/components/features/calendar/fixture-content-checklist";
import { ProductionBar } from "@/components/features/calendar/production-bar";
import { summarizeProduction } from "@/lib/calendar/content-progress";
import { DERBY_INTENSITY_META } from "@/lib/calendar/derby-intensity";
import { formatKickoffTime, formatMatchDayLabel } from "@/lib/calendar/format";
import type { AdSpend, CalendarFixture, TeamRef } from "@/types/calendar";
import type { Result } from "@/types/result";

interface FixtureDetailSheetProps {
  fixture: CalendarFixture | null;
  onOpenChange: (open: boolean) => void;
  onSaveAdSpend: (fixtureId: string, adSpend: AdSpend) => Promise<Result<null>>;
}

export function FixtureDetailSheet({
  fixture,
  onOpenChange,
  onSaveAdSpend,
}: FixtureDetailSheetProps) {
  return (
    <Sheet open={fixture !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        {fixture && (
          <FixtureDetailContent
            key={fixture.id}
            fixture={fixture}
            onSaveAdSpend={(adSpend) => onSaveAdSpend(fixture.id, adSpend)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TeamColumn({ team }: { team: TeamRef }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <TeamLogo logoUrl={team.logoUrl} teamName={team.name} size={40} />
      <span className="text-[13px] font-semibold leading-tight text-foreground">
        {team.name}
      </span>
    </div>
  );
}

interface FixtureDetailContentProps {
  fixture: CalendarFixture;
  onSaveAdSpend: (adSpend: AdSpend) => Promise<Result<null>>;
}

function FixtureDetailContent({ fixture, onSaveAdSpend }: FixtureDetailContentProps) {
  const summary = summarizeProduction(fixture.production);
  const derbyMeta = DERBY_INTENSITY_META[fixture.derbyIntensity];
  const DerbyIcon = derbyMeta.icon;
  const isArchived = isPast(new Date(fixture.kickoffUtc));

  return (
    <>
      <SheetHeader className="gap-1 pb-3">
        <SheetTitle>
          {fixture.homeTeam.shortName} – {fixture.awayTeam.shortName}
        </SheetTitle>
        <SheetDescription>
          {fixture.competition.name}
          {isArchived && " · Arşiv"}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <section className="flex items-center justify-center gap-4 rounded-xl bg-muted/30 px-4 py-5">
          <TeamColumn team={fixture.homeTeam} />
          <span className="shrink-0 text-xs font-semibold text-muted-foreground/50">VS</span>
          <TeamColumn team={fixture.awayTeam} />
        </section>

        <section className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-3.5 shrink-0" />
            Maç günü: {formatMatchDayLabel(fixture.kickoffUtc)} · {formatKickoffTime(fixture.kickoffUtc)}
          </div>
          <div className="flex items-center gap-2">
            <ProductionBar summary={summary} className="w-20" />
            <span>
              <span className="font-medium text-foreground">
                {summary.approved}/{summary.total}
              </span>{" "}
              içerik hazır{summary.draft > 0 ? ` · ${summary.draft} onay bekliyor` : ""}
            </span>
          </div>
          {derbyMeta.label && DerbyIcon && (
            <div className={cn("flex items-center gap-2", derbyMeta.textClassName)}>
              <DerbyIcon className="size-3.5 shrink-0" />
              {derbyMeta.label}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground">
            <LayoutList className="size-3.5" />
            İçerik Kontrol Merkezi
          </h3>
          <FixtureContentChecklist fixtureId={fixture.id} production={fixture.production} />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Megaphone className="size-3.5" />
            Reklam Bütçesi
          </h3>
          <div className="rounded-lg bg-muted/30 p-3">
            <AdSpendForm adSpend={fixture.contentPlan?.adSpend ?? { currency: "TRY" }} onSave={onSaveAdSpend} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <RadioTower className="size-3.5" />
            CheckMatch Canlı Veri
          </h3>
          <MarketCalculationsPanel fixtureId={fixture.id} />
        </section>
      </div>

    </>
  );
}
