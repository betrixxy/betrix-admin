import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { PlayerH2HForm } from "@/components/features/dashboard/player-h2h/player-h2h-form";
import { getMatchDayFixtureOptions } from "@/lib/dashboard/match-day-fixtures";
import { h2hPlayerOptions } from "@/lib/dashboard/player-h2h-studio";

export const metadata: Metadata = {
  title: "Oyuncu Karşılaştırması — betrix.pro",
  description: "İki oyuncunun sezon istatistikleri karşı karşıya: poster + kelebek grafiği",
};

// Canlı fikstür ve arşiv — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

interface PlayerH2HPageProps {
  /** Maç Merkezi / İçerik Planı'nın "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function PlayerH2HPage({ searchParams }: PlayerH2HPageProps) {
  const [fixtures, players, params] = await Promise.all([getMatchDayFixtureOptions(), h2hPlayerOptions(), searchParams]);
  const fixtureList = fixtures.ok ? fixtures.data : [];
  const requested = typeof params.fixtureId === "string" ? params.fixtureId : null;
  const initialFixtureId = fixtureList.some((fixture) => fixture.id === requested) ? requested : null;

  return (
    <>
      <PageHeader
        title="Oyuncu Karşılaştırması"
        description="Maçtan başlayın (iki takımın gol + asist lideri önerilir) ya da herhangi iki oyuncuyu seçin. Sezon verisi API-Football'dan, son maçlara kadar güncel; kart taslak olarak kaydedilir, yayın manuel."
      />
      {!fixtures.ok ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Maç listesi alınamadı ({fixtures.error.message}) — serbest modu kullanabilirsiniz.</span>
        </div>
      ) : null}
      <PlayerH2HForm fixtures={fixtureList} players={players} initialFixtureId={initialFixtureId} />
    </>
  );
}
