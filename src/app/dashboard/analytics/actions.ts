"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { formatNumber } from "@/lib/dashboard/format";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { prisma } from "@/lib/prisma";
import { syncSocialMetrics } from "@/lib/services/social-metrics";
import { deleteConnection } from "@/lib/services/social/connections";
import { SLUG_TO_PLATFORM, parsePlatformSlug } from "@/lib/services/social/platforms";
import type { SocialActionState } from "@/types/social";

const count = (label: string) =>
  z.coerce
    .number(`${label} sayı olmalıdır.`)
    .int(`${label} tam sayı olmalıdır.`)
    .min(0, `${label} negatif olamaz.`)
    .max(2_000_000_000, `${label} çok büyük.`);

const metricsSchema = z.object({
  postId: z.string().min(1),
  views: count("İzlenme"),
  reach: count("Erişim"),
  impressions: count("Gösterim"),
  likes: count("Beğeni"),
  comments: count("Yorum"),
  shares: count("Paylaşım"),
  saves: count("Kaydetme"),
});

/**
 * Bir gönderinin metriklerini elle girer/günceller (API'si bağlanmamış platformlar için).
 * Kayıt `MANUAL` işaretlenir — mock senkronizasyonu bu kayıtların üzerine yazmaz.
 */
export async function updatePostAnalyticsAction(
  _prevState: SocialActionState,
  formData: FormData,
): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const fields = Object.keys(metricsSchema.shape);
  const parsed = metricsSchema.safeParse(Object.fromEntries(fields.map((key) => [key, formData.get(key)])));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz metrik değeri." };
  }

  const { postId, ...metrics } = parsed.data;
  const data = { ...metrics, source: "MANUAL" as const, lastSyncedAt: new Date() };

  try {
    await prisma.postAnalytics.upsert({
      where: { postId },
      update: data,
      create: { postId, ...data },
    });
  } catch {
    return { error: "Metrikler kaydedilemedi — gönderi silinmiş olabilir." };
  }

  refreshDashboard();
  return { success: true };
}

/** Bağlı tüm hesaplardan metrikleri çeker. `force` işaretliyse kademeli takvim yok sayılır. */
export async function syncMetricsAction(
  _prevState: SocialActionState,
  formData: FormData,
): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const report = await syncSocialMetrics({ force: formData.get("force") === "on" });
  refreshDashboard();

  const summary = `${formatNumber(report.updated)} gönderi güncellendi, ${formatNumber(report.skipped)} atlandı.`;
  if (report.failures.length > 0) {
    const details = report.failures
      .map((failure) => `${PLATFORM_LABELS[failure.platform]}: ${failure.message}`)
      .join(" · ");
    return { error: `${summary} Hatalar — ${details}` };
  }
  return { success: true, notice: summary };
}

/** Hesap bağlantısını koparır; şifreli token'lar silinir, geçmiş metrikler korunur. */
export async function disconnectSocialAction(formData: FormData): Promise<void> {
  if (!(await getCurrentSession())) return;

  const slug = parsePlatformSlug(formData.get("platform"));
  if (!slug) return;

  await deleteConnection(SLUG_TO_PLATFORM[slug]);
  refreshDashboard();
}
