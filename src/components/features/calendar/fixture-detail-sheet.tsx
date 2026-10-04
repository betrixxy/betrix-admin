"use client";

import { isPast } from "date-fns";
import { CalendarClock, Megaphone, RadioTower } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AdSpendForm } from "@/components/features/calendar/ad-spend-form";
import { MarketCalculationsPanel } from "@/components/features/calendar/market-calculations-panel";
import { TeamLogo } from "@/components/features/calendar/team-logo";
import { StudioLauncher } from "@/components/features/dashboard/studio-launcher";
import { CONTENT_STATUS_META } from "@/lib/calendar/content-status";
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
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
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
  const statusMeta = CONTENT_STATUS_META[fixture.contentStatus];
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
            <span className={cn("size-1.5 shrink-0 rounded-full", statusMeta.dotClassName)} />
            İçerik durumu:{" "}
            <span className="font-medium text-foreground">{statusMeta.label}</span>
          </div>
          {derbyMeta.label && DerbyIcon && (
            <div className={cn("flex items-center gap-2", derbyMeta.textClassName)}>
              <DerbyIcon className="size-3.5 shrink-0" />
              {derbyMeta.label}
            </div>
          )}
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

      <SheetFooter className="border-t border-border/60 pt-4">
        {/* Maç Merkezi ile aynı akış: içerik türü → stüdyo (maç bilgileri dolu) → taslak onayı (bkz. CLAUDE.md 1.10). */}
        <StudioLauncher fixtureId={fixture.id} />
      </SheetFooter>
    </>
  );
}
