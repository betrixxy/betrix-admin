import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { MatchDayForm } from "@/components/features/dashboard/match-day-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMatchDayFixtureOptions } from "@/lib/dashboard/match-day-fixtures";
import { getMediaAssetOptions } from "@/lib/dashboard/media-library";
import { isFalConfigured } from "@/lib/services/fal";

export const metadata: Metadata = {
  title: "Maç Günü Kartı — betrix.pro",
  description: "API-Football maçı + oyuncu fotoğrafları → Fal.ai ile harmanlanmış Maç Günü posteri",
};

// Canlı fikstür + kütüphane — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface MatchDayPageProps {
  /** Maç Merkezi'nin "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar (bkz. lib/dashboard/content-types.ts). */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function MatchDayPage({ searchParams }: MatchDayPageProps) {
  const [fixtures, playerOptions, params] = await Promise.all([
    getMatchDayFixtureOptions(),
    getMediaAssetOptions("PLAYER"),
    searchParams,
  ]);
  const falConfigured = isFalConfigured();
  const fixtureList = fixtures.ok ? fixtures.data : [];
  const requestedFixtureId = typeof params.fixtureId === "string" ? params.fixtureId : null;
  // Yalnızca listedeki (API-Football, önümüzdeki 7 gün) bir maç ön-seçilir; bilinmeyen kimlik formu doldurmaz.
  const initialFixtureId = fixtureList.some((fixture) => fixture.id === requestedFixtureId) ? requestedFixtureId : null;

  return (
    <>
      <PageHeader
        title="Maç Günü Kartı"
        description="Maçı seçin, iki oyuncu fotoğrafını yükleyin. Fal.ai oyuncuları keser, takım renklerinde bir stadyum sahnesi üretir ve hepsini tek bir posterde harmanlar; tipografi en son programatik olarak basılır. Sonuç taslak olarak kaydedilir."
      />

      {!falConfigured ? (
        <Notice>
          <code className="rounded bg-black/20 px-1 py-0.5 text-xs">FAL_KEY</code> tanımlı değil — üretim devre dışı.
        </Notice>
      ) : null}
      {!fixtures.ok ? (
        <Notice>
          Maç listesi alınamadı ({fixtures.error.message}). Alanları elle doldurarak yine de kart üretebilirsiniz.
        </Notice>
      ) : null}

      {requestedFixtureId && !initialFixtureId && fixtures.ok ? (
        <Notice>Seçilen maç önümüzdeki 7 günün fikstüründe bulunamadı — maçı listeden seçin ya da alanları elle doldurun.</Notice>
      ) : null}

      <MatchDayForm
        fixtures={fixtureList}
        initialFixtureId={initialFixtureId}
        playerOptions={playerOptions}
        disabled={!falConfigured}
      />
    </>
  );
}
