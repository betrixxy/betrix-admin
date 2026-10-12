"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { publishDraftNow } from "@/lib/dashboard/publish-engine";
import { listPublishGallery } from "@/lib/dashboard/publish-media";
import { GALLERY_MAX_PICK, PUBLISH_LAYOUTS, PUBLISH_PLATFORMS, type GalleryItem, type PublishedInfo } from "@/types/publishing";
import type { Result } from "@/types/result";

/**
 * Yayın Merkezi'nin doğrudan paylaşım aksiyonları. Oturumu kendileri doğrular; paylaşım yalnızca admin
 * tıklamasıyla çalışır (bkz. CLAUDE.md 1.10) ve platform/medya/metin sunucuda yeniden doğrulanır.
 */

const idSchema = z.string().min(1).max(64);
const publishSchema = z.object({
  id: idSchema,
  platform: z.enum(PUBLISH_PLATFORMS),
  layout: z.enum(PUBLISH_LAYOUTS),
  mediaOrder: z.array(z.string().max(500)).min(1).max(GALLERY_MAX_PICK + 1),
  caption: z.string().trim().min(1, "Gönderi metni boş olamaz.").max(2200, "Metin en fazla 2200 karakter olabilir."),
});

function unauthorized<T>(): Result<T> {
  return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
}

/** "Hemen Paylaş": seçilen platforma API ile paylaşır; başarılıysa taslak PUBLISHED olur ve gönderi bağlantısı kaydedilir. */
export async function publishDraftAction(input: unknown): Promise<Result<PublishedInfo>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Yayın ayarları geçersiz." } };
  const { id, caption, ...settings } = parsed.data;
  const result = await publishDraftNow(id, { settings, caption });
  if (result.ok) refreshDashboard();
  return result;
}

/** "Galeriden Görsel Ekle": daha önce üretilmiş kartlar ve AI görselleri (açık taslak hariç). */
export async function listGalleryAction(id: unknown): Promise<Result<GalleryItem[]>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz taslak." } };
  return { ok: true, data: await listPublishGallery(parsed.data) };
}
