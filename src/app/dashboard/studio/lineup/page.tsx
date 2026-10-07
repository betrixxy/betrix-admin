import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { LineupForm } from "@/components/features/dashboard/lineup/lineup-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMatchDayFixtureOptions } from "@/lib/dashboard/match-day-fixtures";

export const metadata: Metadata = {
  title: "Muhtemel 11 — betrix.pro",
  description: "İki takımın muhtemel ilk 11'i ve dizilişi — tipografi ve forma numarası odaklı kadro kartı",
};

// Canlı fikstür — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface LineupPageProps {
  /** Maç Merkezi / Takvim'in "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function LineupPage({ searchParams }: LineupPageProps) {
  const [fixtures, params] = await Promise.all([getMatchDayFixtureOptions(), searchParams]);
  const fixtureList = fixtures.ok ? fixtures.data : [];
  const requestedFixtureId = typeof params.fixtureId === "string" ? params.fixtureId : null;
  const initialFixtureId = fixtureList.some((fixture) => fixture.id === requestedFixtureId) ? requestedFixtureId : null;

  return (
    <>
      <PageHeader
        title="Muhtemel 11"
        description="Maçı seçin; açıklanmış ilk 11 ya da takımların son maçtaki 11'i ve dizilişi taslak olarak gelir. Dizilişi ve 11 pozisyonu kadrodan seçip iki takımın kadro kartını önizleyin — oyuncu fotoğrafı kullanılmaz."
      />

      {!fixtures.ok ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Maç listesi alınamadı ({fixtures.error.message}).</span>
        </div>
      ) : null}

      <LineupForm fixtures={fixtureList} initialFixtureId={initialFixtureId} />
    </>
  );
}
