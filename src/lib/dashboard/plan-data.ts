import { formatProductionSummary, summarizeProduction } from "@/lib/calendar/content-progress";
import { getFixtureProduction } from "@/lib/calendar/production";
import { groupRowsByDay, watchedToRow, type FixtureDayGroup, type FixtureRowData } from "@/lib/dashboard/fixture-row";
import { addDays, istanbulDay, istanbulDayBounds } from "@/lib/metrics/istanbul-time";
export { parsePlanCursor, planStartDay } from "@/lib/dashboard/plan-cursor";
import { prisma } from "@/lib/prisma";
import { parseFixtureId } from "@/lib/services/api-football";
import { getFixtureDetailsByIds } from "@/lib/services/api-football/fixtures";
import { mapApiFootballFixtureToFixture } from "@/lib/services/api-football/mappers";
import type { Fixture } from "@/types/sports";

/**
 * İçerik Planı — yalnızca yıldızlı maçlar, İstanbul gününe göre gruplu, geçmiş 1 gün + gelecek.
 * Sayfalama gün imleciyle (`yyyy-MM-dd`), 7'şer gün. Liste `WatchedFixture` anlık görüntüsünden
 * çizilir; durum/skor yalnızca canlı/yeni bitmiş olabilecek maçlar için sağlayıcıdan tazelenir.
 */

export const PLAN_PAGE_DAYS = 7;
/** Bu aralıktaki maçların durumu/skoru sağlayıcıdan tazelenir (dün başlayan → yarın başlayacak). */
const REFRESH_PAST_MS = 2 * 24 * 60 * 60 * 1000;
const REFRESH_FUTURE_MS = 24 * 60 * 60 * 1000;
/** Canlı skor için kısa önbellek. */
const LIVE_TTL_MS = 60 * 1000;

export interface PlanRow extends FixtureRowData {
  /** "3/6 hazır · 1 onay bekliyor" */
  progress: string;
  hasDrafts: boolean;
}

export interface PlanPage {
  groups: FixtureDayGroup<PlanRow>[];
  /** Sonraki sayfanın başlangıç günü; daha ileride yıldızlı maç yoksa null. */
  nextCursor: string | null;
}

async function refreshLive(watched: { fixtureId: string; kickoffUtc: Date }[], now: Date): Promise<Map<string, Fixture>> {
  const ids = watched
    .filter((row) => {
      const delta = row.kickoffUtc.getTime() - now.getTime();
      return delta > -REFRESH_PAST_MS && delta < REFRESH_FUTURE_MS;
    })
    .map((row) => parseFixtureId(row.fixtureId))
    .filter((id): id is number => id !== null);
  if (ids.length === 0) return new Map();
  const result = await getFixtureDetailsByIds(ids, { ttlMs: LIVE_TTL_MS });
  // Sağlayıcıya ulaşılamazsa liste anlık görüntüyle çizilir (durum "alınamadı" görünür, uydurulmaz).
  if (!result.ok) return new Map();
  return new Map(result.data.map((raw) => {
    const fixture = mapApiFootballFixtureToFixture(raw);
    return [fixture.id, fixture] as const;
  }));
}

/** İmleç gününden itibaren 7 günlük sayfa. İlk sayfada imleç, ilk yıldızlı maçın gününe atlar (boş haftalar gösterilmez). */
export async function getPlanPage(cursor: string, now: Date): Promise<PlanPage> {
  const first = await prisma.watchedFixture.findFirst({
    where: { kickoffUtc: { gte: istanbulDayBounds(cursor).start } },
    orderBy: { kickoffUtc: "asc" },
    select: { kickoffUtc: true },
  });
  if (!first) return { groups: [], nextCursor: null };
  const fromDay = istanbulDay(first.kickoffUtc) > cursor ? istanbulDay(first.kickoffUtc) : cursor;
  const toDay = addDays(fromDay, PLAN_PAGE_DAYS);
  const range = { gte: istanbulDayBounds(fromDay).start, lt: istanbulDayBounds(toDay).start };

  const [watched, next] = await Promise.all([
    prisma.watchedFixture.findMany({ where: { kickoffUtc: range }, orderBy: { kickoffUtc: "asc" } }),
    prisma.watchedFixture.findFirst({ where: { kickoffUtc: { gte: range.lt } }, orderBy: { kickoffUtc: "asc" }, select: { kickoffUtc: true } }),
  ]);
  const ids = watched.map((row) => row.fixtureId);
  const [fresh, production] = await Promise.all([refreshLive(watched, now), getFixtureProduction(ids)]);

  const rows: PlanRow[] = watched.map((row) => {
    const summary = summarizeProduction(production.get(row.fixtureId) ?? {});
    return { ...watchedToRow(row, fresh.get(row.fixtureId), now), progress: formatProductionSummary(summary), hasDrafts: summary.draft > 0 };
  });
  return { groups: groupRowsByDay(rows, now), nextCursor: next ? istanbulDay(next.kickoffUtc) : null };
}
