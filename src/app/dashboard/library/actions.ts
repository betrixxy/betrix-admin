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
  // Takım: "645"; turnuva logosu: "league-203" — set rozeti şeffaf logoyu bununla bulur (`findLeagueLogoUrl`).
  teamId: z.string().trim().regex(/^(\d*|league-\d+)$/, "Kimlik rakam (takım) ya da league-<id> (turnuva) olmalı — API-Football."),
  // Maç fotoğrafı (MATCH_PHOTO): maç "1584435" ya da "api-football-1584435", isteğe bağlı oyuncu kimliği.
  fixtureId: z.string().trim().regex(/^((api-football-)?\d+)?$/, "Maç kimliği rakam olmalı (API-Football fixture id)."),
  playerId: z.string().trim().regex(/^\d*$/, "Oyuncu kimliği yalnızca rakam olmalı (API-Football)."),
});

/** Kütüphaneye görsel ekler — içerik-adresli; aynı dosya aynı klasöre ikinci kez eklenmez. */
export async function uploadMediaAction(_prev: MediaActionState, formData: FormData): Promise<MediaActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const parsed = uploadSchema.safeParse({
    category: formData.get("category"),
    label: formData.get("label"),
    teamName: formData.get("teamName") ?? "",
    teamId: formData.get("teamId") ?? "",
    fixtureId: formData.get("fixtureId") ?? "",
    playerId: formData.get("playerId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Bir görsel dosyası seçin." };

  const { category, label, teamName, teamId, fixtureId, playerId } = parsed.data;
  if (category === "MATCH_PHOTO" && !fixtureId) return { error: "Maç fotoğrafı için maç kimliğini girin (Maç Merkezi'ndeki API-Football fixture id)." };
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
      fixtureId: category === "MATCH_PHOTO" && fixtureId ? `api-football-${fixtureId.replace(/^api-football-/, "")}` : null,
      playerId: playerId ? Number(playerId) : null,
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
