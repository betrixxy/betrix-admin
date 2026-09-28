import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { DraftQueue } from "@/components/features/dashboard/draft-queue";
import { MatchList } from "@/components/features/dashboard/match-list";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getDraftCountsByFixture, getDraftQueue } from "@/lib/dashboard/draft-data";
import { getFixtureLabels, getSelectableFixtures, SELECTABLE_FIXTURE_DAYS } from "@/lib/dashboard/fixtures";
import { isFalConfigured } from "@/lib/services/fal";

export const metadata: Metadata = {
  title: "Maç Merkezi — betrix.pro",
  description: "Gerçek fikstür, tek tıkla AI içerik taslağı ve onay kuyruğu",
};

// Canlı fikstür ve veritabanı — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default async function MatchesPage() {
  const [fixtures, queue, fixtureLabels] = await Promise.all([
    getSelectableFixtures(),
    getDraftQueue(),
    getFixtureLabels(),
  ]);
  const falConfigured = isFalConfigured();
  const fixtureList = fixtures.ok ? fixtures.data : [];
  const draftCounts = await getDraftCountsByFixture(fixtureList.map((fixture) => fixture.id));

  return (
    <>
      <PageHeader
        title="Maç Merkezi"
        description={`Önümüzdeki ${SELECTABLE_FIXTURE_DAYS} günün gerçek fikstürü (API-Football). "AI İçerik Üret" maçın gerçek istatistiklerini çeker, Fal.ai ile görseli üretir ve taslağı onayınıza sunar — hiçbir içerik onaysız yayına hazır sayılmaz.`}
      />

      {!falConfigured ? (
        <Warning>
          <code className="rounded bg-black/20 px-1 py-0.5 text-xs">FAL_KEY</code> tanımlı değil — görsel üretimi devre dışı.
        </Warning>
      ) : null}
      {!fixtures.ok ? <Warning>Fikstür alınamadı: {fixtures.error.message}</Warning> : null}

      <DraftQueue drafts={queue} fixtureLabels={fixtureLabels} />
      <MatchList fixtures={fixtureList} draftCounts={draftCounts} generationDisabled={!falConfigured} />
    </>
  );
}
