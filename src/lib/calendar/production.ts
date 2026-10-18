import { buildFixtureProduction } from "@/lib/calendar/production-map";
import { prisma } from "@/lib/prisma";
import { APPROVED_STATUSES } from "@/types/ai-content";
import type { FixtureProduction } from "@/types/calendar";

/**
 * Maç başına içerik paketi durumu — gerçek üretim kayıtlarından (bkz. CLAUDE.md 1.10). İçerik
 * Planı satırındaki ilerleme ve maç sayfasındaki kontrol merkezi bu haritayı okur.
 */

export { buildFixtureProduction, type ProductionRow } from "@/lib/calendar/production-map";

/** Verilen maçların üretim haritası (reddedilenler sayılmaz). */
export async function getFixtureProduction(fixtureIds: string[]): Promise<Map<string, FixtureProduction>> {
  if (fixtureIds.length === 0) return new Map();
  const contents = await prisma.aiContent.findMany({
    where: { fixtureId: { in: fixtureIds }, status: { in: ["DRAFT", ...APPROVED_STATUSES] } },
    select: { id: true, fixtureId: true, status: true, contentType: true, resultImageUrl: true, publishAt: true, renderOptions: true },
    orderBy: { createdAt: "desc" },
  });
  return buildFixtureProduction(contents);
}
