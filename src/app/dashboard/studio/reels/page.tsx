import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { ReelsMatchBrowser } from "@/components/features/dashboard/reels-match-browser";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { buildReelListDays } from "@/lib/reels/match-list";
import { formatIstanbulDateTime, publishWindowState } from "@/lib/reels/publish-window";
import {
  isReelActive, isReelSelectable, missingReelMatchIds, overbookedDays, parseReelsLeagues, REEL_MATCH_MISSING_MESSAGE, REEL_STATUS_LABELS,
  REELS_DAILY_SELECTION_LIMIT, REELS_DEFAULT_LEAGUE_IDS, REELS_LEAGUE_CHOICES, reelsWeekRange, reelWatchRange, type ReelsWeekView,
} from "@/lib/reels/selection";
import { getReelsMatches } from "@/lib/services/reels-client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reels Stüdyo — betrix.pro",
  description: "Haftanın maçlarını seçin, veriyi dondurun",
};

// Servisten ve veritabanından canlı okunur (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-primary/15 text-white" : "border-border text-muted-foreground hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}

interface ReelsPageProps {
  searchParams: Promise<{ week?: string | string[]; leagues?: string | string[] }>;
}

export default async function ReelsStudioPage({ searchParams }: ReelsPageProps) {
  const params = await searchParams;
  const view: ReelsWeekView = params.week === "next" ? "next" : "this";
  const leaguesParam = typeof params.leagues === "string" ? params.leagues : undefined;
  const leagues = parseReelsLeagues(leaguesParam);
  const allLeagues = leagues.length === REELS_DEFAULT_LEAGUE_IDS.length;
  const now = new Date();
  const range = reelsWeekRange(view, now);

  const [list, projects] = await Promise.all([
    getReelsMatches({ ...range, leagues }),
    prisma.reelProject.findMany({ orderBy: { kickoffUtc: "asc" }, where: { kickoffUtc: { gte: new Date(now.getTime() - 86_400_000) } } }),
  ]);
  const activeProjects = projects.filter((project) => isReelActive(project.status));
  const cancelledProjects = projects.filter((project) => project.status === "CANCELLED");
  const selectedIds = new Set(activeProjects.map((project) => project.matchId));
  const matches = list.ok ? list.data.matches.filter((match) => isReelSelectable(new Date(match.kickoff_utc), now)) : [];
  const days = buildReelListDays(matches, selectedIds, now);
  const overbooked = overbookedDays(activeProjects.map((project) => project.kickoffUtc));

  // Seçili maçlar süzgeçten bağımsız aranır: görünen lig ya da hafta uyarıyı etkilemez.
  const watched = activeProjects.length > 0 ? await getReelsMatches(reelWatchRange(activeProjects.map((project) => project.kickoffUtc), now)) : null;
  const missing = watched?.ok ? missingReelMatchIds(activeProjects, new Set(watched.data.matches.map((match) => match.match_id)), now) : new Set<number>();
  const href = (next: { week?: ReelsWeekView; leagues?: string | null }) => {
    const query = new URLSearchParams();
    const week = next.week ?? view;
    const chosen = next.leagues === undefined ? leaguesParam : next.leagues;
    if (week === "next") query.set("week", "next");
    if (chosen) query.set("leagues", chosen);
    const text = query.toString();
    return `/dashboard/studio/reels${text ? `?${text}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Reels Stüdyo" description="Haftanın maçlarını seçin, veriyi dondurun. Video her zaman dondurulmuş rakamları gösterir." />

      {overbooked.map(({ day, count }) => (
        <Notice key={day}>{day} için {count} maç seçili; günlük hedef en fazla {REELS_DAILY_SELECTION_LIMIT} video.</Notice>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Seçili projeler</CardTitle>
          <CardDescription>Yayın penceresi: başlama − 30 saat ile başlama − 6 saat arası (İstanbul).</CardDescription>
        </CardHeader>
        <CardContent>
          {watched && !watched.ok ? <Notice>Seçili maçlar servisle karşılaştırılamadı: {watched.error.message}</Notice> : null}
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz seçili maç yok.</p>
          ) : (
            <ul className="flex flex-col">
              {activeProjects.map((project) => (
                <li key={project.id} className="flex flex-col gap-2 border-b border-border/60 py-2.5 text-sm last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/dashboard/studio/reels/${project.id}`} className="font-medium text-white hover:underline">
                      {project.homeName} – {project.awayName}
                    </Link>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatIstanbulDateTime(project.kickoffUtc)}</span>
                      <span>{publishWindowState({ publishFrom: project.publishFrom, publishTo: project.publishTo }, now).label}</span>
                      <Badge variant="secondary">{REEL_STATUS_LABELS[project.status]}</Badge>
                    </span>
                  </div>
                  {missing.has(project.matchId) ? (
                    <p role="alert" className="flex items-start gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      <AlertTriangle className="mt-px size-3.5 shrink-0" />
                      {REEL_MATCH_MISSING_MESSAGE}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {cancelledProjects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>İptal edilenler</CardTitle>
            <CardDescription>Dondurulan sürümler saklanır. Maçı listeden yeniden seçince aynı proje açılır.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {cancelledProjects.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2.5 text-sm last:border-0">
                  <Link href={`/dashboard/studio/reels/${project.id}`} className="text-muted-foreground hover:text-white hover:underline">
                    {project.homeName} – {project.awayName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatIstanbulDateTime(project.kickoffUtc)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Maçlar</CardTitle>
          <CardDescription>{range.from} – {range.to} (İstanbul)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterLink href={href({ week: "this" })} active={view === "this"}>Bu hafta</FilterLink>
            <FilterLink href={href({ week: "next" })} active={view === "next"}>Gelecek hafta</FilterLink>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterLink href={href({ leagues: null })} active={allLeagues}>Tüm varsayılan ligler</FilterLink>
            {REELS_LEAGUE_CHOICES.map((league) => (
              <FilterLink key={league.id} href={href({ leagues: String(league.id) })} active={!allLeagues && leagues.includes(league.id)}>
                {league.label}
              </FilterLink>
            ))}
          </div>
          {!list.ok ? (
            <Notice>{list.error.message}</Notice>
          ) : (
            <>
              {list.data.blocked > 0 ? <Notice>{list.data.blocked} maç dil kapısına takıldığı için listelenmedi.</Notice> : null}
              {days.length === 0 ? <p className="text-sm text-muted-foreground">Bu aralıkta başlamamış maç yok.</p> : <ReelsMatchBrowser days={days} />}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
