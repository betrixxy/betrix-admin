import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FixtureDraftCounts } from "@/lib/dashboard/draft-data";
import { isPastDay } from "@/lib/dashboard/match-center-window";
import { disabledMenu, matchRowState, type MatchRowState } from "@/lib/dashboard/match-row-state";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import type { Fixture } from "@/types/sports";
import { StudioLauncher } from "./studio-launcher";

const dayFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

interface DayGroup {
  key: string;
  title: string;
  fixtures: Fixture[];
}

/**
 * Maçları İstanbul gününe göre ayırır — fikstür başlama saatine göre sıralı olduğundan geçmiş
 * günler en üstte kalır. Geçmiş gün başlığı: "Dün · 15 Ekim Perşembe — Biten maçlar".
 */
function groupByDay(fixtures: Fixture[], now: Date): DayGroup[] {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = istanbulDay(new Date(fixture.kickoffUtc));
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
  }
  const yesterday = addDays(istanbulDay(now), -1);
  return [...groups.entries()].map(([key, dayFixtures]) => {
    const label = dayFormatter.format(new Date(dayFixtures[0]?.kickoffUtc ?? `${key}T12:00:00+03:00`));
    const title = isPastDay(key, now) ? `${key === yesterday ? "Dün · " : ""}${label} — Biten maçlar` : label;
    return { key, title, fixtures: dayFixtures };
  });
}

/** Saat sütunu: başlamamışta saat, bitende skor, canlıda rozet + dakika, ertelenende durum. */
function KickoffCell({ fixture, state }: { fixture: Fixture; state: MatchRowState }) {
  switch (state.kind) {
    case "finished":
      return <span className="text-sm font-semibold tabular-nums text-white">{state.score}</span>;
    case "live":
      return (
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">Canlı</span>
          {state.minute ? <span className="text-xs tabular-nums text-red-300">{state.minute}</span> : null}
        </span>
      );
    case "inactive":
      return <span className="text-xs text-amber-300">{state.label}</span>;
    case "upcoming":
      return <span className="text-sm font-medium text-white">{timeFormatter.format(new Date(fixture.kickoffUtc))}</span>;
  }
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
          Dün ve önümüzdeki günlerde desteklenen liglerde maç bulunamadı.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(fixtures, new Date()).map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="capitalize">{group.title}</CardTitle>
            <CardDescription>{group.fixtures.length} maç</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {group.fixtures.map((fixture) => {
                const counts = draftCounts[fixture.id];
                const state = matchRowState(fixture);
                return (
                  <li key={fixture.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                    <div className="flex w-28 shrink-0 flex-col">
                      <KickoffCell fixture={fixture} state={state} />
                      <span className="truncate text-[11px] text-muted-foreground">{fixture.competition.shortName}</span>
                    </div>
                    <div className="grid min-w-[16rem] flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <TeamCell name={fixture.homeTeam.name} logoUrl={fixture.homeTeam.logoUrl} align="end" />
                      <span className="text-xs text-muted-foreground">vs</span>
                      <TeamCell name={fixture.awayTeam.name} logoUrl={fixture.awayTeam.logoUrl} align="start" />
                    </div>
                    <div className="flex items-center gap-3">
                      {counts ? (
                        <span className="text-[11px] text-muted-foreground">
                          {counts.drafts} taslak · {counts.approved} onaylı
                        </span>
                      ) : null}
                      {/* Evre değişince (maç bitti) menü yeni evrenin varsayılanıyla yeniden kurulur. */}
                      <StudioLauncher key={state.phase ?? state.kind} fixtureId={fixture.id} phase={state.phase} disabled={disabledMenu(state)} />
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
