"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { MEDIA_CATEGORY_META, addMediaAsset, deleteMediaAsset } from "@/lib/dashboard/media-library";
import { inspectImageUpload } from "@/lib/dashboard/studio-images";
import type { Result } from "@/types/result";
import { MEDIA_CATEGORIES, type MediaActionState } from "@/types/media";

const uploadSchema = z.object({
  category: z.enum(MEDIA_CATEGORIES, "Bir klasör seçin."),
  label: z.string().trim().min(1, "Bir ad girin.").max(120, "Ad en fazla 120 karakter olabilir."),
  teamName: z.string().trim().max(120),
  teamId: z.string().trim().regex(/^\d*$/, "Takım kimliği yalnızca rakam olmalı (API-Football)."),
});

/** Kütüphaneye görsel ekler — içerik-adresli; aynı dosya aynı klasöre ikinci kez eklenmez. */
export async function uploadMediaAction(_prev: MediaActionState, formData: FormData): Promise<MediaActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const parsed = uploadSchema.safeParse({
    category: formData.get("category"),
    label: formData.get("label"),
    teamName: formData.get("teamName") ?? "",
    teamId: formData.get("teamId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Bir görsel dosyası seçin." };

  const { category, label, teamName, teamId } = parsed.data;
  const minShortSide = MEDIA_CATEGORY_META[category].minShortSide;
  const image = await inspectImageUpload(file, "Görsel", minShortSide ? { minShortSide } : {});
  if (!image.ok) return { error: image.error.message };

  try {
    const { asset, created } = await addMediaAsset({
      image: image.data,
      category,
      label,
      teamName: teamName || null,
      teamId: teamId || null,
    });
    refreshDashboard();
    return {
      notice: created
        ? `"${asset.label}" ${MEDIA_CATEGORY_META[category].label.toLocaleLowerCase("tr-TR")} klasörüne eklendi.`
        : `Bu görsel zaten kütüphanede: "${asset.label}".`,
    };
  } catch {
    return { error: "Görsel kaydedilemedi — depolama alanına yazılamadı veya veritabanına ulaşılamadı." };
  }
}

export async function deleteMediaAction(id: string): Promise<Result<{ fileKept: boolean }>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  try {
    const result = await deleteMediaAsset(id);
    refreshDashboard();
    return { ok: true, data: result };
  } catch (cause) {
    return { ok: false, error: { code: "DELETE_FAILED", message: "Görsel silinemedi.", cause } };
  }
}
