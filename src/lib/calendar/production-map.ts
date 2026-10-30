import { isSchedulePlaceholder } from "@/lib/calendar/schedule-placeholder";
import { resolveContentTypeId } from "@/lib/dashboard/content-types";
import { setPages } from "@/lib/dashboard/set-pages";
import { isApprovedStatus } from "@/types/ai-content";
import type { FixtureProduction } from "@/types/calendar";
import type { ContentTypeId } from "@/types/content-type";

/** Maç başına içerik paketi durumu — saf (bkz. `production.ts`). */

export interface ProductionRow {
  id: string;
  fixtureId: string;
  status: string;
  contentType: string | null;
  resultImageUrl: string | null;
  publishAt: Date | null;
  /** Set carousel'i (Maç Sonucu 01 + 02 İstatistikler) bu alandan anlaşılır. */
  renderOptions?: unknown;
}

/**
 * Saf: kaydın karşıladığı içerik türleri. Carousel'li Maç Sonucu taslağı (01 + 02 [+ 03 oyuncu sayfası])
 * Maç İstatistikleri'ni ve Oyuncu İstatistikleri'ni de AYNI durumla karşılar — ayrıca üretilmemiş sayılmaz.
 */
export function coveredContentTypes(contentType: ContentTypeId, renderOptions: unknown): ContentTypeId[] {
  return setPages(contentType, renderOptions);
}

/**
 * Saf: kayıtlar (en yeniden eskiye) → maç → tür → en ileri durum. Onaylı her zaman kazanır, aksi
 * halde en yeni taslak; yalnızca placeholder varsa "planned". Yayın zamanı türün herhangi bir
 * kaydından gelir.
 */
export function buildFixtureProduction(contents: ProductionRow[]): Map<string, FixtureProduction> {
  const byFixture = new Map<string, FixtureProduction>();
  for (const content of contents) {
    // Eski kimlikli placeholder (MARKET_RESULTS → PREDICTION_SCORECARD …) yeni türün planı olarak okunur.
    const contentType = content.contentType ? resolveContentTypeId(content.contentType) : null;
    if (!contentType) continue;
    const placeholder = isSchedulePlaceholder(content);
    const production = byFixture.get(content.fixtureId) ?? {};
    for (const type of placeholder ? [contentType] : coveredContentTypes(contentType, content.renderOptions)) {
      const current = production[type];
      // Kapsanan türün yayın zamanı kendi planından gelir; kaydın kendi zamanı yalnızca kendi türüne.
      const own = type === contentType ? content.publishAt?.toISOString() : undefined;
      const publishAt = current?.publishAt ?? own ?? null;
      if (placeholder) {
        if (!current && publishAt) production[type] = { status: "planned", publishAt };
        // Kapsanan türün planı (ör. 02'nin yayın zamanı) carousel taslağına geçer.
        else if (current && !current.publishAt && publishAt) production[type] = { ...current, publishAt };
      } else if (!current || current.status === "planned" || (current.status === "draft" && isApprovedStatus(content.status))) {
        production[type] = { status: isApprovedStatus(content.status) ? "approved" : "draft", draftId: content.id, publishAt };
      } else if (!current.publishAt && publishAt) {
        production[type] = { ...current, publishAt };
      }
    }
    byFixture.set(content.fixtureId, production);
  }
  return byFixture;
}
