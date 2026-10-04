import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FixtureDraftCounts } from "@/lib/dashboard/draft-data";
import type { Fixture, FixtureStatus } from "@/types/sports";
import { StudioLauncher } from "./studio-launcher";

const dayFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

const STATUS_LABELS: Partial<Record<FixtureStatus, string>> = {
  LIVE: "Canlı",
  HT: "Devre arası",
  FT: "Bitti",
  POSTPONED: "Ertelendi",
  CANCELLED: "İptal",
};

/** Maçları İstanbul saatine göre günlere ayırır — fikstür zaten başlama saatine göre sıralıdır. */
function groupByDay(fixtures: Fixture[]): [string, Fixture[]][] {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const day = dayFormatter.format(new Date(fixture.kickoffUtc));
    groups.set(day, [...(groups.get(day) ?? []), fixture]);
  }
  return [...groups.entries()];
}

function TeamCell({ name, logoUrl, align }: { name: string; logoUrl: string; align: "start" | "end" }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="" className="size-6 shrink-0 object-contain" loading="lazy" />
      <span className="truncate text-sm text-white">{name}</span>
    </span>
  );
}

interface MatchListProps {
  fixtures: Fixture[];
  draftCounts: Record<string, FixtureDraftCounts>;
}

export function MatchList({ fixtures, draftCounts }: MatchListProps) {
  if (fixtures.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Önümüzdeki günlerde desteklenen liglerde maç bulunamadı.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(fixtures).map(([day, dayFixtures]) => (
        <Card key={day}>
          <CardHeader>
            <CardTitle className="capitalize">{day}</CardTitle>
            <CardDescription>{dayFixtures.length} maç</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {dayFixtures.map((fixture) => {
                const counts = draftCounts[fixture.id];
                const statusLabel = STATUS_LABELS[fixture.status];
                return (
                  <li key={fixture.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                    <div className="flex w-24 shrink-0 flex-col">
                      <span className="text-sm font-medium text-white">{timeFormatter.format(new Date(fixture.kickoffUtc))}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{fixture.competition.shortName}</span>
                    </div>
                    <div className="grid min-w-[16rem] flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <TeamCell name={fixture.homeTeam.name} logoUrl={fixture.homeTeam.logoUrl} align="end" />
                      <span className="text-xs text-muted-foreground">vs</span>
                      <TeamCell name={fixture.awayTeam.name} logoUrl={fixture.awayTeam.logoUrl} align="start" />
                    </div>
                    <div className="flex items-center gap-3">
                      {statusLabel ? <span className="text-[11px] text-amber-300">{statusLabel}</span> : null}
                      {counts ? (
                        <span className="text-[11px] text-muted-foreground">
                          {counts.drafts} taslak · {counts.approved} onaylı
                        </span>
                      ) : null}
                      <StudioLauncher fixtureId={fixture.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
