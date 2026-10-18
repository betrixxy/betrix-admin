import type { PredictionSource } from "@/types/prediction";

/**
 * checkmatch.net (Mac sunucusu) tahmin kaynağı — YALNIZCA ARAYÜZ.
 *
 * TODO: `lib/services/checkmatch-core::getMatchCalculations(fixtureId)` → `PredictionSet` eşlemesi:
 *  - market/seçim → `ScenarioId` + makine okunur `ScenarioOutcome` (iç kimlikler; kartta bahis dili yok),
 *  - `probability` doğrudan, `sourceVersion` = sitenin model sürümü,
 *  - `scenarioCount` ve `surprisePct` sitenin kendi değerleri (iç modelin sayımı kullanılmaz).
 * Kart ve motor kaynağı bilmez; kaynak seçimi stüdyoda tek satırla değişir.
 */
export const checkmatchSiteSource: PredictionSource = {
  id: "checkmatch-site",
  predict: async () => ({ ok: false, error: { code: "NOT_IMPLEMENTED", message: "checkmatch.net tahmin kaynağı henüz bağlanmadı." } }),
};
