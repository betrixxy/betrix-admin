import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FixtureDraftCounts } from "@/lib/dashboard/draft-data";
import { fixtureToRow, groupRowsByDay, type FixtureDayGroup, type FixtureRowData } from "@/lib/dashboard/fixture-row";
import { isOlderPastDay, POST_MATCH_PAST_DAYS } from "@/lib/dashboard/match-center-window";
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

function DayCard({ group, draftCounts, watchedIds }: { group: FixtureDayGroup<FixtureRowData> } & Omit<MatchListProps, "fixtures">) {
  return (
    <Card>
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
  );
}

/**
 * Dün + önümüzdeki günler üstte açık; dünden eski günler (maç sonrası penceresi, son POST_MATCH_PAST_DAYS gün)
 * altta kapalı "Önceki günler" bölümünde, en yeni gün önde.
 */
export function MatchList({ fixtures, draftCounts, watchedIds }: MatchListProps) {
  if (fixtures.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Son {POST_MATCH_PAST_DAYS} gün ve önümüzdeki günlerde desteklenen liglerde maç bulunamadı.
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const groups = groupRowsByDay(fixtures.map(fixtureToRow), now);
  const recent = groups.filter((group) => !isOlderPastDay(group.key, now));
  const older = groups.filter((group) => isOlderPastDay(group.key, now)).reverse();
  const olderCount = older.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {recent.map((group) => (
        <DayCard key={group.key} group={group} draftCounts={draftCounts} watchedIds={watchedIds} />
      ))}
      {older.length > 0 ? (
        <details className="flex flex-col gap-4 rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-white">
            Önceki günler — son {POST_MATCH_PAST_DAYS} günün biten maçları ({olderCount} maç · maç sonrası içerik üretilebilir)
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {older.map((group) => (
              <DayCard key={group.key} group={group} draftCounts={draftCounts} watchedIds={watchedIds} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
