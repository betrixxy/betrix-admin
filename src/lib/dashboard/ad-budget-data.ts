import { z } from "zod";
import { AD_PLATFORM_ORDER } from "@/lib/calendar/ad-platform";
import { totalAdSpend } from "@/lib/calendar/ad-spend";
import { prisma } from "@/lib/prisma";
import type { AdPlatform, AdSpend } from "@/types/calendar";

/**
 * Etkileşim & Reklam panelindeki bütçe özeti — kaynak `ContentPlan` (takvimde maç başına
 * girilen planlanan reklam bütçesi, bkz. app/calendar/actions.ts). Ziyaret sayısı, o maça ait
 * gönderilerin takip linkiyle (`cm_post`) gelen `TrafficLog` kayıtlarıdır.
 */

const PLAN_LIMIT = 50;

const adSpendSchema = z.object({
  meta: z.number().optional(),
  tiktok: z.number().optional(),
  youtube: z.number().optional(),
  x: z.number().optional(),
  currency: z.string(),
});

export interface AdBudgetRow {
  fixtureId: string;
  /** ISO 8601 — planlanan yayın tarihi. */
  scheduledFor: string;
  spend: Partial<Record<AdPlatform, number>>;
  total: number;
  /** Bu maçın gönderilerinden takip linkiyle gelen ziyaret. */
  attributedVisits: number;
  /** total / attributedVisits — ziyaret yoksa null (sıfıra bölme uydurulmaz). */
  costPerVisit: number | null;
}

export interface AdBudgetOverview {
  rows: AdBudgetRow[];
  totalsByPlatform: Record<AdPlatform, number>;
  grandTotal: number;
  attributedVisits: number;
  costPerVisit: number | null;
}

function toSpend(value: unknown): Partial<Record<AdPlatform, number>> {
  const parsed = adSpendSchema.safeParse(value);
  if (!parsed.success) return {};
  const spend: Partial<Record<AdPlatform, number>> = {};
  for (const platform of AD_PLATFORM_ORDER) {
    const amount = parsed.data[platform];
    if (amount !== undefined && amount > 0) spend[platform] = amount;
  }
  return spend;
}

export async function getAdBudgetOverview(): Promise<AdBudgetOverview> {
  const plans = await prisma.contentPlan.findMany({ orderBy: { scheduledFor: "desc" }, take: PLAN_LIMIT });
  const fixtureIds = plans.map((plan) => plan.fixtureId);

  const visitRows = fixtureIds.length
    ? await prisma.trafficLog.findMany({
        where: { post: { fixtureId: { in: fixtureIds } } },
        select: { post: { select: { fixtureId: true } } },
      })
    : [];
  const visitsByFixture = new Map<string, number>();
  for (const row of visitRows) {
    const fixtureId = row.post?.fixtureId;
    if (fixtureId) visitsByFixture.set(fixtureId, (visitsByFixture.get(fixtureId) ?? 0) + 1);
  }

  const totalsByPlatform: Record<AdPlatform, number> = { meta: 0, tiktok: 0, youtube: 0, x: 0 };
  const rows: AdBudgetRow[] = [];
  for (const plan of plans) {
    const spend = toSpend(plan.adSpend);
    const total = totalAdSpend({ ...spend, currency: "TRY" } satisfies AdSpend);
    if (total === 0) continue;
    for (const platform of AD_PLATFORM_ORDER) totalsByPlatform[platform] += spend[platform] ?? 0;

    const attributedVisits = visitsByFixture.get(plan.fixtureId) ?? 0;
    rows.push({
      fixtureId: plan.fixtureId,
      scheduledFor: plan.scheduledFor.toISOString(),
      spend,
      total,
      attributedVisits,
      costPerVisit: attributedVisits > 0 ? total / attributedVisits : null,
    });
  }

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const attributedVisits = rows.reduce((sum, row) => sum + row.attributedVisits, 0);
  return {
    rows,
    totalsByPlatform,
    grandTotal,
    attributedVisits,
    costPerVisit: attributedVisits > 0 ? grandTotal / attributedVisits : null,
  };
}
