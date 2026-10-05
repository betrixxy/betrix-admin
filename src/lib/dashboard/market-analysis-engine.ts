import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { renderDeepAnalysisCard } from "@/lib/dashboard/deep-analysis-render";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { saveStoredFile } from "@/lib/dashboard/storage";
import type { ContentTypeId } from "@/types/content-type";
import type { MarketAnalysisDraft } from "@/types/deep-analysis";
import type { Result } from "@/types/result";

export interface MarketAnalysisSaved {
  id: string;
  homeImageUrl: string;
  awayImageUrl: string;
}

/** Form verisini Prisma `Json` sütununa yazılabilir düz JSON'a çevirir. */
function toJsonValue(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function buildCaption(draft: MarketAnalysisDraft): string {
  const lines = [`DERİNLEMESİNE ANALİZ | ${draft.home.teamName} - ${draft.away.teamName}`];
  if (draft.marketPick) lines.push(`🎯 Olası market: ${draft.marketPick}${draft.marketRationale ? ` — ${draft.marketRationale}` : ""}`);
  return lines.join("\n");
}

/**
 * İki takımın Derinlemesine Analiz kartını çizer, kalıcı depoya yazar ve tek bir `AiContent`
 * (contentType = AI_MARKET_PREDICTION, DRAFT) kaydı açar. Takvimde bu maç için planlanmış bir
 * placeholder varsa üretim onun üzerine yazılır ve yayın zamanı korunur (bkz. content-schedule.ts).
 * Fal.ai yok — tamamen programatik, ücretsiz. Ana görsel ev sahibi kartıdır; iki kartın adresi,
 * formun tamamı ve market tahmini `renderOptions`'ta saklanır.
 */
export async function createMarketAnalysisDraft(draft: MarketAnalysisDraft): Promise<Result<MarketAnalysisSaved>> {
  let homePng: Buffer;
  let awayPng: Buffer;
  try {
    [homePng, awayPng] = await Promise.all([
      renderDeepAnalysisCard({ team: draft.home, opponentName: draft.away.teamName }),
      renderDeepAnalysisCard({ team: draft.away, opponentName: draft.home.teamName }),
    ]);
  } catch (cause) {
    console.error("[market-analysis] kartlar çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Analiz kartları çizilemedi.", cause } };
  }

  const saved: string[] = [];
  try {
    const homeImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, homePng);
    saved.push(homeImageUrl);
    const awayImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, awayPng);
    saved.push(awayImageUrl);

    const record = await createScheduledContent({
      fixtureId: draft.fixtureId,
      contentType: "AI_MARKET_PREDICTION" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: homeImageUrl,
      status: "DRAFT",
      format: "IG_FEED",
      caption: buildCaption(draft),
      renderOptions: toJsonValue({
        kind: "MARKET_ANALYSIS",
        homeImageUrl,
        awayImageUrl,
        home: draft.home,
        away: draft.away,
        marketPick: draft.marketPick,
        marketRationale: draft.marketRationale,
      }),
    });
    return { ok: true, data: { id: record.id, homeImageUrl, awayImageUrl } };
  } catch (cause) {
    // Kayıt açılamadıysa yazılan dosyalar yetim kalmasın (bkz. CLAUDE.md 1.10 kural 3).
    await Promise.all(saved.map((url) => deleteStoredUrl(url)));
    console.error("[market-analysis] kaydedilemedi:", cause);
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Analiz kaydedilemedi — depolamaya ya da veritabanına yazılamadı.", cause } };
  }
}
