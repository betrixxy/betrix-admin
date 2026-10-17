import { isSchedulePlaceholder } from "@/lib/calendar/schedule-placeholder";
import { isContentTypeId } from "@/lib/dashboard/content-types";
import { isApprovedStatus } from "@/types/ai-content";
import type { FixtureProduction } from "@/types/calendar";

/** Maç başına içerik paketi durumu — saf (bkz. `production.ts`). */

export interface ProductionRow {
  id: string;
  fixtureId: string;
  status: string;
  contentType: string | null;
  resultImageUrl: string | null;
  publishAt: Date | null;
}

/**
 * Saf: kayıtlar (en yeniden eskiye) → maç → tür → en ileri durum. Onaylı her zaman kazanır, aksi
 * halde en yeni taslak; yalnızca placeholder varsa "planned". Yayın zamanı türün herhangi bir
 * kaydından gelir.
 */
export function buildFixtureProduction(contents: ProductionRow[]): Map<string, FixtureProduction> {
  const byFixture = new Map<string, FixtureProduction>();
  for (const content of contents) {
    if (!content.contentType || !isContentTypeId(content.contentType)) continue;
    const placeholder = isSchedulePlaceholder(content);
    const production = byFixture.get(content.fixtureId) ?? {};
    const current = production[content.contentType];
    const publishAt = current?.publishAt ?? content.publishAt?.toISOString() ?? null;
    if (placeholder) {
      if (!current && publishAt) production[content.contentType] = { status: "planned", publishAt };
    } else if (!current || current.status === "planned" || (current.status === "draft" && isApprovedStatus(content.status))) {
      production[content.contentType] = { status: isApprovedStatus(content.status) ? "approved" : "draft", draftId: content.id, publishAt };
    } else if (!current.publishAt && publishAt) {
      production[content.contentType] = { ...current, publishAt };
    }
    byFixture.set(content.fixtureId, production);
  }
  return byFixture;
}
