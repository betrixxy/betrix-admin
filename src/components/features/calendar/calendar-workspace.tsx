"use client";

import { useMemo, useState } from "react";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { CalendarToolbar } from "@/components/features/calendar/calendar-toolbar";
import { FixtureDetailSheet } from "@/components/features/calendar/fixture-detail-sheet";
import { MonthGrid } from "@/components/features/calendar/month-grid";
import { derivePlatformsFromAdSpend } from "@/lib/calendar/ad-spend";
import { hasContentPlan } from "@/lib/calendar/content-plan";
import type { AdSpend, CalendarFixture } from "@/types/calendar";

interface CalendarWorkspaceProps {
  fixtures: CalendarFixture[];
}

export function CalendarWorkspace({ fixtures: initialFixtures }: CalendarWorkspaceProps) {
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);

  // Yalnızca içerik planı olan (derbi/rekabet seviyesindeki) maçlar takvimde gösterilir.
  const plannedFixtures = useMemo(() => fixtures.filter(hasContentPlan), [fixtures]);
  const selectedFixture =
    plannedFixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null;

  function handleSaveAdSpend(fixtureId: string, adSpend: AdSpend) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === fixtureId && fixture.contentPlan
          ? {
              ...fixture,
              contentPlan: {
                ...fixture.contentPlan,
                adSpend,
                platforms: derivePlatformsFromAdSpend(adSpend),
              },
            }
          : fixture,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <CalendarToolbar
        month={month}
        onPrevMonth={() => setMonth((current) => subMonths(current, 1))}
        onNextMonth={() => setMonth((current) => addMonths(current, 1))}
        onToday={() => setMonth(startOfMonth(new Date()))}
      />

      <MonthGrid month={month} fixtures={plannedFixtures} onSelect={setSelectedFixtureId} />

      <FixtureDetailSheet
        fixture={selectedFixture}
        onOpenChange={(open) => {
          if (!open) setSelectedFixtureId(null);
        }}
        onSaveAdSpend={handleSaveAdSpend}
      />
    </div>
  );
}
