"use server";

import { revalidatePath } from "next/cache";
import { subDays } from "date-fns";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { derivePlatformsFromAdSpend } from "@/lib/calendar/ad-spend";
import { setContentSchedule } from "@/lib/calendar/content-schedule";
import { isContentTypeId } from "@/lib/dashboard/content-types";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { prisma } from "@/lib/prisma";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import { getMatchCalculations } from "@/lib/services/checkmatch-core";
import type { CheckmatchCoreError } from "@/lib/services/checkmatch-core";
import type { AdSpend } from "@/types/calendar";
import type { MatchCalculations } from "@/types/market";
import type { Result } from "@/types/result";

/**
 * checkmatch-core servis katmanına ince bir Server Action köprüsü — client bileşenler
 * (bkz. market-calculations-panel.tsx) servis fonksiyonunu doğrudan değil, bunun
 * üzerinden çağırır (bkz. CLAUDE.md 1.5 — route handler/server action ince kalır).
 *
 * Server Action'lar herkese açık POST uç noktalarıdır; `proxy.ts` yalnızca sayfa
 * isteklerini korur. VIP token'lı Mac sunucusu çağrısı bu yüzden oturumu burada doğrular.
 */
export async function getMatchCalculationsAction(
  fixtureId: string,
): Promise<Result<MatchCalculations, CheckmatchCoreError>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  return getMatchCalculations(fixtureId);
}

const amount = z.number().int().min(0).max(10_000_000).optional();
const adSpendSchema = z.object({
  meta: amount,
  tiktok: amount,
  youtube: amount,
  x: amount,
  currency: z.literal("TRY"),
});

/** İçerik planı, maçtan bu kadar gün önce yayınlanacak şekilde varsayılan olarak planlanır. */
const DEFAULT_PLAN_LEAD_DAYS = 1;

/**
 * Maç başına reklam bütçesini `ContentPlan` tablosuna kalıcı yazar (önceden yalnızca tarayıcı
 * state'indeydi). Plan yoksa oluşturulur; yayın tarihi gerçek başlama saatinden türetilir.
 */
export async function saveAdSpendAction(fixtureId: string, adSpend: AdSpend): Promise<Result<null>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }

  const apiId = parseFixtureId(fixtureId);
  const parsed = adSpendSchema.safeParse(adSpend);
  if (apiId === null || !parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz maç veya bütçe." } };
  }

  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { ok: false, error: { code: fixture.error.code, message: fixture.error.message } };

  const data = { adSpend: parsed.data, platforms: derivePlatformsFromAdSpend(parsed.data) };
  try {
    await prisma.contentPlan.upsert({
      where: { fixtureId },
      update: data,
      create: {
        ...data,
        fixtureId,
        scheduledFor: subDays(new Date(fixture.data.kickoffUtc), DEFAULT_PLAN_LEAD_DAYS),
      },
    });
  } catch (cause) {
    return { ok: false, error: { code: "SAVE_FAILED", message: "Bütçe kaydedilemedi.", cause } };
  }

  revalidatePath("/calendar");
  return { ok: true, data: null };
}

const schedulePublishAtSchema = z.iso.datetime({ offset: true }).nullable();

/**
 * Bir maçın bir içerik türü için yayın zamanını planlar (`AiContent.publishAt`) ya da planı
 * kaldırır (`null`). İçerik henüz üretilmemişse placeholder kaydı açılır; stüdyo ilk üretimi
 * onun üzerine yazar — bkz. lib/calendar/content-schedule.ts.
 */
export async function scheduleContentAction(
  fixtureId: string,
  contentType: string,
  publishAt: string | null,
): Promise<Result<null>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }

  const apiId = parseFixtureId(fixtureId);
  const parsedPublishAt = schedulePublishAtSchema.safeParse(publishAt);
  if (apiId === null || !isContentTypeId(contentType) || !parsedPublishAt.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz maç, içerik türü veya tarih." } };
  }

  // Yalnızca gerçek bir maça plan yazılır (yanıt önbellekli, kotayı zorlamaz).
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { ok: false, error: { code: fixture.error.code, message: fixture.error.message } };

  try {
    await setContentSchedule(fixtureId, contentType, parsedPublishAt.data === null ? null : new Date(parsedPublishAt.data));
  } catch (cause) {
    return { ok: false, error: { code: "SAVE_FAILED", message: "Yayın zamanı kaydedilemedi.", cause } };
  }

  revalidatePath("/calendar");
  return { ok: true, data: null };
}
