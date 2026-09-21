import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { CalendarWorkspace } from "@/components/features/calendar/calendar-workspace";
import { getMockFixtures } from "@/lib/calendar/mock-fixtures";

export const metadata: Metadata = {
  title: "İçerik Takvimi — betrix.pro",
  description: "Fikstür tabanlı içerik planlama ve üretim durumu takvimi",
};

const NAV_SECTIONS = [
  { label: "Dashboard", active: false },
  { label: "Studio", active: false },
  { label: "Takvim", active: true },
] as const;

export default function CalendarPage() {
  const fixtures = getMockFixtures();

  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 left-1/2 h-72 w-[50rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[140px]"
      />

      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5 lg:px-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                CM
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold text-white">
                  CheckMatch.net
                </span>
                <span className="text-[10px] text-muted-foreground">
                  betrix.pro Studio
                </span>
              </div>
            </div>

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
            FAZ 3 · Fikstür ve İçerik Takvimi
          </span>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1600px] px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-7 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            İçerik Takvimi
          </h1>
          <p className="text-sm text-muted-foreground">
            İçerik üretim takvimini gözden geçir; detayları görmek için bir
            maça tıkla, oradan doğrudan Stüdyo&apos;ya aktar.
          </p>
        </div>

        <CalendarWorkspace fixtures={fixtures} />
      </main>
    </div>
  );
}
