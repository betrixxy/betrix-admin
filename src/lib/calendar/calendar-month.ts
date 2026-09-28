import { endOfMonth, endOfWeek, format, isValid, parse, startOfMonth, startOfWeek } from "date-fns";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getFixturesForDateRange, type ApiFootballError } from "@/lib/services/api-football";
import type { Result } from "@/types/result";
import type { AdSpend, CalendarFixture, ContentPlan, ContentStatus } from "@/types/calendar";

/** URL'deki `?month=2026-09` parametresi; geçersiz/eksikse içinde bulunulan ay. */
export function parseMonthParam(value: string | string[] | undefined): Date {
  const raw = typeof value === "string" ? value : undefined;
  const parsed = raw && /^\d{4}-\d{2}$/.test(raw) ? parse(raw, "yyyy-MM", new Date()) : null;
  return startOfMonth(parsed && isValid(parsed) ? parsed : new Date());
}

export function formatMonthParam(month: Date): string {
  return format(month, "yyyy-MM");
}

const adPlatformSchema = z.enum(["meta", "tiktok", "youtube", "x"]);
const adSpendSchema = z.object({
  meta: z.number().optional(),
  tiktok: z.number().optional(),
  youtube: z.number().optional(),
  x: z.number().optional(),
  currency: z.string(),
});

/** `ContentPlan.platforms`/`adSpend` JSON sütunları — bozuksa plan yok sayılır, uydurulmaz. */
function toContentPlan(row: {
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

/**
 * İçerik durumu gerçek üretim kayıtlarından türetilir (bkz. CLAUDE.md 1.10):
 * onaylı içerik varsa "Üretildi", onay bekleyen taslak varsa "Bekliyor", yoksa "Fikir".
 */
function deriveContentStatus(statuses: Set<string> | undefined): ContentStatus {
  if (statuses?.has("APPROVED")) return "produced";
  if (statuses?.has("DRAFT")) return "pending";
  return "idea";
}

/**
 * Ay ızgarasının (Pazartesi başlangıçlı, 6 haftaya kadar) gerçek fikstürleri — API-Football —
 * veritabanındaki içerik planları ve AI içerik durumlarıyla birleştirilmiş hâli.
 */
export async function getCalendarMonth(month: Date): Promise<Result<CalendarFixture[], ApiFootballError>> {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const fixturesResult = await getFixturesForDateRange({
    from: format(gridStart, "yyyy-MM-dd"),
    to: format(gridEnd, "yyyy-MM-dd"),
  });
  if (!fixturesResult.ok) return fixturesResult;

  const fixtureIds = fixturesResult.data.map((fixture) => fixture.id);
  const [plans, contents] = await Promise.all([
    prisma.contentPlan.findMany({ where: { fixtureId: { in: fixtureIds } } }),
    prisma.aiContent.findMany({
      where: { fixtureId: { in: fixtureIds }, status: { in: ["DRAFT", "APPROVED"] } },
      select: { fixtureId: true, status: true },
    }),
  ]);

  const planByFixture = new Map(plans.map((plan) => [plan.fixtureId, toContentPlan(plan)]));
  const statusesByFixture = new Map<string, Set<string>>();
  for (const content of contents) {
    const set = statusesByFixture.get(content.fixtureId) ?? new Set<string>();
    set.add(content.status);
    statusesByFixture.set(content.fixtureId, set);
  }

  return {
    ok: true,
    data: fixturesResult.data.map((fixture) => {
      const plan = planByFixture.get(fixture.id);
      return {
        ...fixture,
        contentStatus: deriveContentStatus(statusesByFixture.get(fixture.id)),
        ...(plan ? { contentPlan: plan } : {}),
      };
    }),
  };
}
