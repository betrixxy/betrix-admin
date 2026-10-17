import { z } from "zod";
import type { AdSpend, ContentPlan } from "@/types/calendar";

/**
 * `ContentPlan` satırının (reklam bütçesi + platformlar) güvenli okunması. Eski ay ızgarası
 * (Fikstür CRM) kaldırıldı; veri ve bu ayrıştırıcı maç sayfasındaki reklam bütçesi paneli için durur.
 */

const adPlatformSchema = z.enum(["meta", "tiktok", "youtube", "x"]);
const adSpendSchema = z.object({
  meta: z.number().optional(),
  tiktok: z.number().optional(),
  youtube: z.number().optional(),
  x: z.number().optional(),
  currency: z.string(),
});

/** `ContentPlan.platforms`/`adSpend` JSON sütunları — bozuksa plan yok sayılır, uydurulmaz. */
export function toContentPlan(row: {
  id: string;
  fixtureId: string;
  scheduledFor: Date;
  platforms: unknown;
  adSpend: unknown;
}): ContentPlan | null {
  const platforms = z.array(adPlatformSchema).safeParse(row.platforms);
  const adSpend = adSpendSchema.safeParse(row.adSpend);
  if (!platforms.success || !adSpend.success) return null;

  // exactOptionalPropertyTypes: zod'un `undefined` alanları AdSpend'e taşınmaz.
  const spend: AdSpend = { currency: adSpend.data.currency };
  for (const platform of adPlatformSchema.options) {
    const amount = adSpend.data[platform];
    if (amount !== undefined) spend[platform] = amount;
  }

  return {
    id: row.id,
    fixtureId: row.fixtureId,
    scheduledFor: row.scheduledFor.toISOString(),
    platforms: platforms.data,
    adSpend: spend,
  };
}
