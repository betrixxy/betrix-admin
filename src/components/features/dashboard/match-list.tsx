import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FixtureDraftCounts } from "@/lib/dashboard/draft-data";
import { fixtureToRow, groupRowsByDay } from "@/lib/dashboard/fixture-row";
import { disabledMenu } from "@/lib/dashboard/match-row-state";
import type { Fixture } from "@/types/sports";
import { FixtureRow } from "./fixture-row";
import { StarButton } from "./star-button";
import { StudioLauncher } from "./studio-launcher";

/** İşlem sütunu: yıldız · taslak sayıları · içerik türü menüsü + "Stüdyoya Git". */
const ACTIONS_WIDTH = "30rem";

interface MatchListProps {
  fixtures: Fixture[];
  draftCounts: Record<string, FixtureDraftCounts>;
  /** Yıldızlı (İçerik Planı'ndaki) maç kimlikleri. */
  watchedIds: Set<string>;
}

export function MatchList({ fixtures, draftCounts, watchedIds }: MatchListProps) {
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
      {groupRowsByDay(fixtures.map(fixtureToRow), new Date()).map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="capitalize">{group.title}</CardTitle>
            <CardDescription>{group.rows.length} maç</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {group.rows.map((row) => {
                const counts = draftCounts[row.id];
                return (
                  <FixtureRow
                    key={row.id}
                    row={row}
                    actionsWidth={ACTIONS_WIDTH}
                    actions={
                      <>
                        <span className="w-24 shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                          {counts ? `${counts.drafts} taslak · ${counts.approved} onaylı` : null}
                        </span>
                        {/* Evre değişince (maç bitti) menü yeni evrenin varsayılanıyla yeniden kurulur. */}
                        <StudioLauncher key={row.state.phase ?? row.state.kind} fixtureId={row.id} phase={row.state.phase} disabled={disabledMenu(row.state)} />
                        <StarButton fixtureId={row.id} starred={watchedIds.has(row.id)} label={`${row.homeName} – ${row.awayName}`} />
                      </>
                    }
                  />
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
