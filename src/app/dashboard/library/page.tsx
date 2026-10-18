import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ArchiveContentOverview } from "@/components/features/archive/archive-overview";
import { PersonFolderView, SearchResultsView, TeamFolderView } from "@/components/features/archive/archive-content";
import { ArchiveInbox } from "@/components/features/archive/archive-inbox";
import { ArchiveSyncForm, ArchiveTransferSuggestions } from "@/components/features/archive/archive-person-tools";
import { ArchiveTree } from "@/components/features/archive/archive-tree";
import { LegacyMediaView } from "@/components/features/archive/legacy-media-view";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getArchiveTree, getInbox, getPeopleOptions, getPendingTransfers, getTeamFolder, getTeamOptions, searchArchive } from "@/lib/archive/queries";
import { ARCHIVE_GROUPS, type ArchiveGroup } from "@/lib/archive/structure";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Medya Kütüphanesi — betrix.pro",
  description: "Fotoğraf arşivi (Lig / Takım / Kişi), logolar ve referans görseller",
};

export const dynamic = "force-dynamic";

const VIEWS = { archive: "Fotoğraf Arşivi", logos: "Logolar", references: "Referanslar" } as const;
type View = keyof typeof VIEWS;

type Param = string | string[] | undefined;
const one = (value: Param) => (typeof value === "string" ? value : undefined);

interface LibraryPageProps {
  searchParams: Promise<{ view?: Param; team?: Param; person?: Param; group?: Param; q?: Param; inbox?: Param }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const view: View = (Object.keys(VIEWS) as View[]).find((key) => key === one(params.view)) ?? "archive";
  return (
    <>
      <PageHeader
        title="Medya Kütüphanesi"
        description="Fotoğraf arşivi Lig / Takım / Kişi klasörlerinde — adlar API-Football ve resmi ad tablosundan, elle klasör adı yok. Logolar ve referans görseller ayrı sekmelerde."
      />
      <nav className="flex flex-wrap gap-2" aria-label="Kütüphane">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link
            key={key}
            href={key === "archive" ? "/dashboard/library" : `/dashboard/library?view=${key}`}
            className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", key === view ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white")}
          >
            {VIEWS[key]}
          </Link>
        ))}
      </nav>
      {view === "logos" ? <LegacyMediaView category="LOGO" /> : view === "references" ? <LegacyMediaView category="REFERENCE" /> : <ArchiveView params={params} />}
    </>
  );
}

async function ArchiveView({ params }: { params: Awaited<LibraryPageProps["searchParams"]> }) {
  const teamId = Number(one(params.team));
  const personId = one(params.person) ?? null;
  const group = ARCHIVE_GROUPS.find((entry) => entry === one(params.group)) ?? null;
  const query = one(params.q)?.trim() ?? "";
  const inbox = one(params.inbox) === "1";

  const [tree, folder, teams, transfers, inboxAssets] = await Promise.all([
    getArchiveTree(),
    Number.isInteger(teamId) && teamId > 0 ? getTeamFolder(teamId) : Promise.resolve(null),
    getTeamOptions(),
    getPendingTransfers(),
    getInbox(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-4 pt-6">
          <form action="/dashboard/library" className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input name="q" defaultValue={query} placeholder="Kişi, takım, açıklama…" className="h-8 pl-8 text-xs" />
          </form>
          <ArchiveTree leagues={tree} folder={folder} selectedPerson={personId} inboxCount={inboxAssets.length} inboxActive={inbox} />
          <ArchiveSyncForm teamId={folder?.id ?? null} teamName={folder?.name ?? null} />
        </CardContent>
      </Card>
      <div className="flex min-w-0 flex-col gap-4">
        <ArchiveTransferSuggestions items={transfers} />
        {query ? (
          <SearchResultsView query={query} results={await searchArchive(query)} teams={teams} />
        ) : inbox ? (
          <ArchiveInbox assets={inboxAssets} teams={teams} people={await getPeopleOptions()} />
        ) : folder && personId ? (
          <PersonFolderView folder={folder} personId={personId} teams={teams} />
        ) : folder ? (
          <TeamFolderView folder={folder} group={group as ArchiveGroup | null} teams={teams} />
        ) : (
          <ArchiveContentOverview tree={tree} inboxCount={inboxAssets.length} />
        )}
      </div>
    </div>
  );
}
