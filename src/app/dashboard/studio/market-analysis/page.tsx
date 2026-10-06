import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { MarketAnalysisForm } from "@/components/features/dashboard/market-analysis/market-analysis-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMatchDayFixtureOptions } from "@/lib/dashboard/match-day-fixtures";
import { getMediaAssetOptions } from "@/lib/dashboard/media-library";
import { isFalConfigured } from "@/lib/services/fal";
import { isAnthropicConfigured } from "@/lib/services/anthropic";

export const metadata: Metadata = {
  title: "AI Market Tahmin & Analiz — betrix.pro",
  description: "İki takımın son maç verisiyle Derinlemesine Analiz kartları ve market tahmini",
};

// Canlı fikstür — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface MarketAnalysisPageProps {
  /** Maç Merkezi / Takvim'in "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function MarketAnalysisPage({ searchParams }: MarketAnalysisPageProps) {
  const [fixtures, playerOptions, params] = await Promise.all([getMatchDayFixtureOptions(), getMediaAssetOptions("PLAYER"), searchParams]);
  const fixtureList = fixtures.ok ? fixtures.data : [];
  const requestedFixtureId = typeof params.fixtureId === "string" ? params.fixtureId : null;
  const initialFixtureId = fixtureList.some((fixture) => fixture.id === requestedFixtureId) ? requestedFixtureId : null;

  return (
    <>
      <PageHeader
        title="AI Market Tahmin & Analiz"
        description="Maçı seçin; iki takımın son 5 maçındaki form, xG, topla oynama, pas isabeti ve anahtar oyuncuları çekilir. Güçlü yönler, dikkat edilmesi gerekenler ve taktiksel yaklaşım veriden önerilir — düzenleyip her takım için Derinlemesine Analiz kartını önizleyin."
      />

      {!fixtures.ok ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Maç listesi alınamadı ({fixtures.error.message}).</span>
        </div>
      ) : null}

      <MarketAnalysisForm
        fixtures={fixtureList}
        initialFixtureId={initialFixtureId}
        analystAvailable={isAnthropicConfigured()}
        playerOptions={playerOptions}
        falConfigured={isFalConfigured()}
      />
    </>
  );
}
