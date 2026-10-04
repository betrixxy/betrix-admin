"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { saveAdSpendAction } from "@/app/calendar/actions";
import { CalendarToolbar } from "@/components/features/calendar/calendar-toolbar";
import { FixtureDetailSheet } from "@/components/features/calendar/fixture-detail-sheet";
import { MonthGrid } from "@/components/features/calendar/month-grid";
import type { AdSpend, CalendarFixture } from "@/types/calendar";
import type { Result } from "@/types/result";

interface CalendarWorkspaceProps {
  /** Ay ızgarasının gerçek fikstürleri (API-Football) + içerik planı/durumu — sunucuda hazırlanır. */
  fixtures: CalendarFixture[];
  /** `yyyy-MM` — ay değişimi URL ile yapılır, sunucu o ayın verisini çeker. */
  month: string;
}

export function CalendarWorkspace({ fixtures, month }: CalendarWorkspaceProps) {
  const router = useRouter();
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const monthDate = parseISO(`${month}-01`);
  const selectedFixture = fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null;

  function goToMonth(target: Date) {
    router.push(`/calendar?month=${format(target, "yyyy-MM")}`);
  }

  async function handleSaveAdSpend(fixtureId: string, adSpend: AdSpend): Promise<Result<null>> {
    const result = await saveAdSpendAction(fixtureId, adSpend);
    if (result.ok) router.refresh();
    return result;
  }

  return (
    <div className="flex flex-col gap-5">
      <CalendarToolbar
        month={monthDate}
        onPrevMonth={() => goToMonth(subMonths(monthDate, 1))}
        onNextMonth={() => goToMonth(addMonths(monthDate, 1))}
        onToday={() => goToMonth(new Date())}
      />

      <MonthGrid month={monthDate} fixtures={fixtures} onSelect={setSelectedFixtureId} />

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
