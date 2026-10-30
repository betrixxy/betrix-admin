import Link from "next/link";

/**
 * Maç Sonucu setinin "…de ekle" seçenekleri: Maç Analizi (01 zaman çizelgesi + 02 devre devre; devre verisi yoksa
 * yalnızca zaman çizelgesi) ve Tahmin Karnesi (A). Sayfalar 02/03'ten sonra sabit sırada, aynı format ve zeminle.
 * Karne seçeneği maçın sayılan tahmini ve yazılmış sonucu yoksa KAPALI ve sebebi görünür.
 */
export function SetExtrasOptions({ fixtureId, scorecardBlocker }: { fixtureId: string; scorecardBlocker: string | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="includeAnalysis" className="mt-0.5" />
        <span>
          Maç analizini de ekle
          <span className="block text-[11px] text-muted-foreground">
            Zaman çizelgesi (kırılma anları) + devre devre istatistik — carousel&apos;in sonunda, aynı format ve zemin. Devre verisi yoksa yalnızca zaman çizelgesi eklenir, sebep notlarda.
          </span>
        </span>
      </label>
      <label className={scorecardBlocker ? "flex items-start gap-2 opacity-60" : "flex items-start gap-2"}>
        <input type="checkbox" name="includeScorecard" disabled={scorecardBlocker !== null} className="mt-0.5" />
        <span>
          Tahmin karnesini de ekle
          <span className="block text-[11px] text-muted-foreground">Bu maçın onaylanmış tahminlerinin tuttu/tutmadı karnesi — en son sayfa.</span>
          {scorecardBlocker ? (
            <span className="block text-[11px] text-amber-300">
              {scorecardBlocker}{" "}
              <Link href={`/dashboard/studio/prediction-scorecard?fixtureId=${fixtureId}`} className="underline">
                Tahmin Karnesi stüdyosu
              </Link>
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}
