import { loadStudioAnalysisFacts } from "@/lib/dashboard/match-analysis-engine";
import { loadFixtureRecords } from "@/lib/dashboard/prediction-scorecard-data";
import type { SetExtrasRequest } from "@/lib/dashboard/set-extra-pages";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { scorecardBlocker } from "@/lib/prediction/scorecard-studio";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Maç Sonucu setinin "…de ekle" verisi (yalnızca okuma): Maç Analizi olayları + devre verisi; Tahmin Karnesi için
 * maçın kayıtları ve yazılmış sonuçları. Karne ancak sayılan kayıtların sonucu yazılmışsa eklenir — formda kapalı
 * seçenek sunucuda da reddedilir (sebep aynı metin).
 */
export async function loadSetExtras(raw: ApiFootballFixtureResultRaw, fixtureId: string, wanted: { analysis: boolean; scorecard: boolean }): Promise<{ ok: true; data: SetExtrasRequest } | { ok: false; error: string }> {
  let analysis: MatchAnalysisFacts | null = null;
  if (wanted.analysis) {
    reportJobStep("Maç Analizi verisi alınıyor");
    analysis = await loadStudioAnalysisFacts(raw);
    if (!analysis) return { ok: false, error: "Maç Analizi verisi alınamadı — kart üretilmedi." };
  }
  if (wanted.scorecard) {
    const blocker = scorecardBlocker(await loadFixtureRecords(fixtureId));
    if (blocker) return { ok: false, error: `Tahmin karnesi eklenemedi: ${blocker}` };
  }
  return { ok: true, data: { analysis, scorecard: wanted.scorecard } };
}

/** Formdaki "Tahmin karnesini de ekle" seçeneğinin durumu: sebep ya da null (açık). Okunamazsa sebep yazılır. */
export async function scorecardOptionBlocker(fixtureId: string): Promise<string | null> {
  try {
    return scorecardBlocker(await loadFixtureRecords(fixtureId));
  } catch (error: unknown) {
    console.error("[karne] kayıtlar okunamadı:", error);
    return "Tahmin kayıtları okunamadı.";
  }
}
