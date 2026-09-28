"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { prisma } from "@/lib/prisma";
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
  likes: count("Beğeni"),
  comments: count("Yorum"),
  shares: count("Paylaşım"),
});

/**
 * Bir gönderinin metriklerini elle girer/günceller. Meta/TikTok API'leri bağlanana kadar
 * `PostAnalytics`'i dolduran tek yoldur; senkronizasyon geldiğinde aynı tabloyu yazacak.
 */
export async function updatePostAnalyticsAction(
  _prevState: SocialActionState,
  formData: FormData,
): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const parsed = metricsSchema.safeParse({
    postId: formData.get("postId"),
    views: formData.get("views"),
    likes: formData.get("likes"),
    comments: formData.get("comments"),
    shares: formData.get("shares"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz metrik değeri." };
  }

  const { postId, ...metrics } = parsed.data;

  try {
    await prisma.postAnalytics.upsert({
      where: { postId },
      update: { ...metrics, lastSyncedAt: new Date() },
      create: { postId, ...metrics },
    });
  } catch {
    return { error: "Metrikler kaydedilemedi — gönderi silinmiş olabilir." };
  }

  refreshDashboard();
  return { success: true };
}
