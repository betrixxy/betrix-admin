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

export default async function MatchDayPage() {
  const [fixtures, playerOptions] = await Promise.all([getMatchDayFixtureOptions(), getMediaAssetOptions("PLAYER")]);
  const falConfigured = isFalConfigured();

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

      <MatchDayForm
        fixtures={fixtures.ok ? fixtures.data : []}
        playerOptions={playerOptions}
        disabled={!falConfigured}
      />
    </>
  );
}
