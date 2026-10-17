"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Star } from "lucide-react";
import { loadPlanPageAction } from "@/app/dashboard/plan/actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disabledMenu } from "@/lib/dashboard/match-row-state";
import type { PlanPage, PlanRow } from "@/lib/dashboard/plan-data";
import type { FixtureDayGroup } from "@/lib/dashboard/fixture-row";
import { cn } from "@/lib/utils";
import { FixtureRow } from "./fixture-row";
import { StarButton } from "./star-button";
import { StudioLauncher } from "./studio-launcher";

/** İşlem sütunu: ilerleme · içerik türü menüsü · yıldız. */
const ACTIONS_WIDTH = "32rem";

function PlanActions({ row }: { row: PlanRow }) {
  return (
    <>
      <span className={cn("w-32 shrink-0 text-right text-[11px] leading-tight", row.hasDrafts ? "text-amber-300" : "text-muted-foreground")}>{row.progress}</span>
      <StudioLauncher key={row.state.phase ?? row.state.kind} fixtureId={row.id} phase={row.state.phase} disabled={disabledMenu(row.state)} />
      <StarButton fixtureId={row.id} starred label={`${row.homeName} – ${row.awayName}`} />
    </>
  );
}

function EmptyPlan() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
        <Star className="size-6 text-amber-400" />
        <p>
          Henüz yıldızlı maç yok. Maç Merkezi&apos;nde takip etmek istediğiniz maçın satırındaki ☆ ile İçerik Planı&apos;na ekleyin.
        </p>
        <Link href="/dashboard/matches" className={buttonVariants({ size: "sm", variant: "outline" })}>
          Maç Merkezi
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * İçerik Planı listesi — gün gün, aşağı kaydırdıkça sonraki 7 gün yüklenir (IntersectionObserver
 * + Server Action). Sunucu ilk sayfayı çizer; sonraki sayfalar istemcide eklenir.
 */
export function PlanList({ initial }: { initial: PlanPage }) {
  const [groups, setGroups] = useState<FixtureDayGroup<PlanRow>[]>(initial.groups);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    const result = await loadPlanPageAction(cursor);
    if (result.ok) {
      setGroups((current) => [...current, ...result.page.groups.filter((group) => !current.some((existing) => existing.key === group.key))]);
      setCursor(result.page.nextCursor);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [cursor, loading]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || error) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, error, loadMore]);

  if (groups.length === 0 && !cursor) return <EmptyPlan />;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="capitalize">{group.title}</CardTitle>
            <CardDescription>{group.rows.length} yıldızlı maç</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {group.rows.map((row) => (
                <FixtureRow key={row.id} row={row} actionsWidth={ACTIONS_WIDTH} actions={<PlanActions row={row} />} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      <div ref={sentinel} className="flex min-h-10 items-center justify-center text-xs text-muted-foreground">
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {error ? (
          <button type="button" onClick={() => void loadMore()} className="text-destructive underline">
            {error} — tekrar dene
          </button>
        ) : null}
        {!cursor && !loading && groups.length > 0 ? "Daha ileride yıldızlı maç yok." : null}
      </div>
    </div>
  );
}
