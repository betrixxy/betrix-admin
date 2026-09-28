"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { prisma } from "@/lib/prisma";
import type { Result } from "@/types/result";
import {
  SOCIAL_PLATFORM_TYPES,
  SOCIAL_POST_STATUSES,
  type SocialActionState,
  type SocialPostStatus,
} from "@/types/social";

const postFieldsSchema = z.object({
  fixtureId: z.string().min(1, "Bir maç seçin."),
  platformType: z.enum(SOCIAL_PLATFORM_TYPES, "Bir platform seçin."),
  caption: z
    .string()
    .trim()
    .min(1, "Gönderi metni boş olamaz.")
    .max(2200, "Gönderi metni en fazla 2200 karakter olabilir."),
  scheduledFor: z.coerce.date("Geçerli bir yayın tarihi girin."),
});

const updatePostSchema = postFieldsSchema.extend({
  postId: z.string().min(1),
  status: z.enum(SOCIAL_POST_STATUSES, "Geçersiz durum."),
});

/**
 * `PUBLISHED`'a geçişte yayın zamanı damgalanır (zaten yayınlanmışsa korunur) ve metrik
 * satırı (PostAnalytics) yoksa sıfırlarla oluşturulur; `PREPARING`'e dönüşte yayın zamanı temizlenir.
 */
function statusData(status: SocialPostStatus, postId: string, currentPublishedAt: Date | null) {
  if (status === "PUBLISHED") {
    return {
      status,
      publishedAt: currentPublishedAt ?? new Date(),
      analytics: { connectOrCreate: { where: { postId }, create: {} } },
    } as const;
  }
  return { status, publishedAt: null } as const;
}

/** Platform kaydı ilk kullanımda oluşturulur — ayrıca seed gerekmez. */
async function ensurePlatformId(type: (typeof SOCIAL_PLATFORM_TYPES)[number]): Promise<string> {
  const platform = await prisma.socialPlatform.upsert({
    where: { type },
    update: {},
    create: { type, displayName: PLATFORM_LABELS[type] },
  });
  return platform.id;
}

export async function createSocialPostAction(
  _prevState: SocialActionState,
  formData: FormData,
): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const parsed = postFieldsSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    platformType: formData.get("platformType"),
    caption: formData.get("caption"),
    scheduledFor: formData.get("scheduledFor"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  }

  const { fixtureId, platformType, caption, scheduledFor } = parsed.data;

  try {
    const platformId = await ensurePlatformId(platformType);
    const contentPlan = await prisma.contentPlan.findUnique({ where: { fixtureId } });

    await prisma.socialPost.create({
      data: { fixtureId, platformId, contentPlanId: contentPlan?.id ?? null, caption, scheduledFor },
    });
  } catch {
    return { error: "Gönderi kaydedilemedi — veritabanı bağlantısını kontrol edin." };
  }

  refreshDashboard();
  return { success: true };
}

export async function updateSocialPostAction(
  _prevState: SocialActionState,
  formData: FormData,
): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const parsed = updatePostSchema.safeParse({
    postId: formData.get("postId"),
    fixtureId: formData.get("fixtureId"),
    platformType: formData.get("platformType"),
    caption: formData.get("caption"),
    scheduledFor: formData.get("scheduledFor"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  }

  const { postId, fixtureId, platformType, caption, scheduledFor, status } = parsed.data;

  try {
    const current = await prisma.socialPost.findUnique({
      where: { id: postId },
      select: { publishedAt: true },
    });
    if (!current) return { error: "Gönderi bulunamadı — silinmiş olabilir." };

    const platformId = await ensurePlatformId(platformType);
    const contentPlan = await prisma.contentPlan.findUnique({ where: { fixtureId } });

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        fixtureId,
        platformId,
        contentPlanId: contentPlan?.id ?? null,
        caption,
        scheduledFor,
        ...statusData(status, postId, current.publishedAt),
      },
    });
  } catch {
    return { error: "Gönderi güncellenemedi — veritabanı bağlantısını kontrol edin." };
  }

  refreshDashboard();
  return { success: true };
}

export async function updateSocialPostStatusAction(
  postId: string,
  status: SocialPostStatus,
): Promise<Result<null>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }

  const parsedStatus = z.enum(SOCIAL_POST_STATUSES).safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: { code: "INVALID_STATUS", message: "Geçersiz durum." } };
  }

  try {
    const current = await prisma.socialPost.findUnique({
      where: { id: postId },
      select: { publishedAt: true },
    });
    if (!current) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Gönderi bulunamadı." } };
    }
    await prisma.socialPost.update({
      where: { id: postId },
      data: statusData(parsedStatus.data, postId, current.publishedAt),
    });
  } catch (cause) {
    return { ok: false, error: { code: "UPDATE_FAILED", message: "Durum güncellenemedi.", cause } };
  }

  refreshDashboard();
  return { ok: true, data: null };
}

export async function deleteSocialPostAction(postId: string): Promise<Result<null>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }

  try {
    await prisma.socialPost.delete({ where: { id: postId } });
  } catch (cause) {
    return { ok: false, error: { code: "DELETE_FAILED", message: "Gönderi silinemedi.", cause } };
  }

  refreshDashboard();
  return { ok: true, data: null };
}
