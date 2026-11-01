import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { SelectMatchButton } from "@/components/features/dashboard/reels-action-buttons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { competitionShortName } from "@/lib/names/competition-names";
import { prisma } from "@/lib/prisma";
import { formatIstanbulDateTime, formatIstanbulTime, formatPublishWindow, publishWindow, publishWindowState } from "@/lib/reels/publish-window";
import {
  isReelSelectable, overbookedDays, parseReelsLeagues, REEL_STATUS_LABELS, REELS_DAILY_SELECTION_LIMIT, REELS_DEFAULT_LEAGUE_IDS,
  REELS_LEAGUE_CHOICES, reelsWeekRange, type ReelsWeekView,
} from "@/lib/reels/selection";
import { getReelsMatches } from "@/lib/services/reels-client";
import type { ReelsMatchListItem } from "@/lib/services/reels-schema";
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

function TeamName({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" width={20} height={20} className="size-5 shrink-0 object-contain" loading="lazy" />
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}

function MatchRow({ match, selected, now }: { match: ReelsMatchListItem; selected: boolean; now: Date }) {
  const kickoff = new Date(match.kickoff_utc);
  const window = publishWindow(kickoff);
  return (
    <li className="grid grid-cols-1 items-center gap-2 border-b border-border/60 py-3 text-sm last:border-0 md:grid-cols-[7rem_minmax(0,1fr)_11rem_auto]">
      <div className="text-muted-foreground">
        <div className="font-medium text-white">{formatIstanbulTime(kickoff)}</div>
        <div className="text-xs">{formatIstanbulDateTime(kickoff).split(" ")[0]} · {competitionShortName(match.league.id, match.league.name)}</div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <TeamName name={match.home.name} logoUrl={match.home.logo_url} />
        <TeamName name={match.away.name} logoUrl={match.away.logo_url} />
      </div>
      <div className="text-xs text-muted-foreground">
        <div className={match.analysis.available ? "text-emerald-300" : "text-amber-300"}>{match.analysis.available ? "Analiz var" : "Analiz yok"}</div>
        <div>{formatPublishWindow(window)}</div>
        <div>{publishWindowState(window, now).label}</div>
      </div>
      <div className="justify-self-end">
        <SelectMatchButton matchId={match.match_id} selected={selected} />
      </div>
    </li>
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
  const selectedIds = new Set(projects.map((project) => project.matchId));
  const matches = list.ok ? list.data.matches.filter((match) => isReelSelectable(new Date(match.kickoff_utc), now)) : [];
  const overbooked = overbookedDays(projects.map((project) => project.kickoffUtc));
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
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz seçili maç yok.</p>
          ) : (
            <ul className="flex flex-col">
              {projects.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2.5 text-sm last:border-0">
                  <Link href={`/dashboard/studio/reels/${project.id}`} className="font-medium text-white hover:underline">
                    {project.homeName} – {project.awayName}
                  </Link>
                  <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatIstanbulDateTime(project.kickoffUtc)}</span>
                    <span>{publishWindowState({ publishFrom: project.publishFrom, publishTo: project.publishTo }, now).label}</span>
                    <Badge variant="secondary">{REEL_STATUS_LABELS[project.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu aralıkta başlamamış maç yok.</p>
              ) : (
                <ul className="flex flex-col">
                  {matches.map((match) => (
                    <MatchRow key={match.match_id} match={match} selected={selectedIds.has(match.match_id)} now={now} />
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
