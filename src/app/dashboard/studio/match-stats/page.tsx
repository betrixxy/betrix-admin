import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MatchStatsForm } from "@/components/features/dashboard/match-stats-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { loadMatchStatsFacts } from "@/lib/dashboard/match-stats-studio";
import { getMatchResultRaw, parseFixtureId, toFixtureId } from "@/lib/services/api-football";

export const metadata: Metadata = {
  title: "Maç İstatistikleri — betrix.pro",
  description: "Biten maçın istatistik karşılaştırması — CheckMatch set kartı (02)",
};

// Canlı maç durumu — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface MatchStatsPageProps {
  /** Maç Merkezi'nin "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function MatchStatsPage({ searchParams }: MatchStatsPageProps) {
  const params = await searchParams;
  const apiId = typeof params.fixtureId === "string" ? parseFixtureId(params.fixtureId) : null;
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  const validation = raw?.ok ? validateMatchResultFixture(raw.data, new Date()) : null;
  const stats = validation?.ok && raw?.ok && raw.data ? await loadMatchStatsFacts(raw.data) : null;

  return (
    <>
      <PageHeader
        title="Maç İstatistikleri"
        description="Biten maçın topa sahip olma, şut, xG ve diğer karşılaştırmaları — CheckMatch set kartı (02). Kart yalnızca biten maçlar (FT/AET/PEN) için üretilir."
      />
      {!apiId ? (
        <Notice>
          Maç seçilmedi. <Link href="/dashboard/matches" className="underline">Maç Merkezi</Link>&apos;nden biten bir maç için &quot;Maç İstatistikleri&quot;ni seçin.
        </Notice>
      ) : null}
      {raw && !raw.ok ? <Notice>Maç verisi alınamadı: {raw.error.message}</Notice> : null}
      {validation && !validation.ok ? <Notice>{validation.error.message}</Notice> : null}
      {validation?.ok && apiId && !stats ? <Notice>Bu maçın istatistikleri henüz yok.</Notice> : null}
      {validation?.ok && apiId && stats ? (
        <>
          <Notice>
            {validation.data.home.name} {validation.data.home.goals} – {validation.data.away.goals} {validation.data.away.name} · {stats.rows.length} istatistik satırı
            {stats.sportmonksMatched ? " (Sportmonks eşleşti)" : " (yalnızca API-Football)"}. Set olarak paylaşacaksanız Maç Sonucu stüdyosundaki &quot;İstatistik sayfasını da ekle&quot; seçeneği tek taslakta carousel üretir.
          </Notice>
          <MatchStatsForm fixtureId={toFixtureId(apiId)} warnings={stats.warnings} />
        </>
      ) : null}
    </>
  );
}
