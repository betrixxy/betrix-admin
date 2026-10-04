import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { StudioBrand } from "@/components/features/brand/brand-logo";
import { CalendarWorkspace } from "@/components/features/calendar/calendar-workspace";
import { formatMonthParam, getCalendarMonth, parseMonthParam } from "@/lib/calendar/calendar-month";
import { isFalConfigured } from "@/lib/services/fal";

export const metadata: Metadata = {
  title: "İçerik Takvimi — betrix.pro",
  description: "Fikstür tabanlı içerik planlama ve üretim durumu takvimi",
};

const NAV_SECTIONS = [
  { label: "Dashboard", active: false },
  { label: "Studio", active: false },
  { label: "Takvim", active: true },
] as const;

// Canlı fikstür + veritabanı — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface CalendarPageProps {
  searchParams: Promise<{ month?: string | string[] }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const month = parseMonthParam((await searchParams).month);
  const fixtures = await getCalendarMonth(month);

  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 left-1/2 h-72 w-[50rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[140px]"
      />

      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5 lg:px-10">
          <div className="flex items-center gap-6">
            <StudioBrand />

            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_SECTIONS.map((section) => (
                <span
                  key={section.label}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    section.active
                      ? "bg-white/[0.06] text-white"
                      : "text-muted-foreground/60",
                  )}
                >
                  {section.label}
                </span>
              ))}
            </nav>
          </div>

          <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
            Canlı veri · API-Football
          </span>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1600px] px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-7 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            İçerik Takvimi
          </h1>
          <p className="text-sm text-muted-foreground">
            Desteklenen liglerin gerçek fikstürü. Bir maça tıklayıp reklam bütçesini
            kaydedin ya da doğrudan AI içerik taslağı üretin.
          </p>
        </div>

        {!fixtures.ok ? (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Fikstür alınamadı: {fixtures.error.message}</span>
          </div>
        ) : null}
        <CalendarWorkspace
          fixtures={fixtures.ok ? fixtures.data : []}
          month={formatMonthParam(month)}
          generationDisabled={!isFalConfigured()}
        />
      </main>
    </div>
  );
}
