"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createMatchDraft } from "@/lib/dashboard/draft-engine";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { resolveStudioImage, type ResolvedImage } from "@/lib/dashboard/studio-image-input";
import { readStatSelection } from "@/lib/dashboard/studio-stats";
import { prisma } from "@/lib/prisma";
import { isFalConfigured } from "@/lib/services/fal";
import type { Result } from "@/types/result";
import { STUDIO_FORMATS, type StudioActionState } from "@/types/ai-content";

const generateSchema = z.object({
  fixtureId: z.string().min(1, "Bir maç seçin."),
  format: z.enum(STUDIO_FORMATS, "Bir format seçin."),
  customPrompt: z.string().trim().max(1000, "Özel prompt en fazla 1000 karakter olabilir."),
  postId: z.string(),
});

const FAL_NOT_CONFIGURED_MESSAGE =
  "FAL_KEY tanımlı değil — .env.local dosyasına ekleyip sunucuyu yeniden başlatın.";

/**
 * Stüdyo (manuel, yüklemeli) üretim: yüklemeleri doğrula → taslak motoruna devret (gerçek
 * istatistik + Fal.ai `flux`/`birefnet` + render, bkz. lib/dashboard/draft-engine.ts). Sonuç
 * her zaman DRAFT'tır; admin `/dashboard/drafts/<id>` ekranında onaylar (bkz. CLAUDE.md 1.10).
 */
export async function generateAiContentAction(
  _prevState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!isFalConfigured()) return { error: FAL_NOT_CONFIGURED_MESSAGE };

  const parsed = generateSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    format: formData.get("format"),
    customPrompt: formData.get("customPrompt") ?? "",
    postId: formData.get("postId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  }
  const { fixtureId, format, customPrompt, postId } = parsed.data;

  let player: Result<ResolvedImage | null>;
  let logo: Result<ResolvedImage | null>;
  try {
    [player, logo] = await Promise.all([
      resolveStudioImage(formData, "playerPhoto", "PLAYER", "Oyuncu fotoğrafı"),
      resolveStudioImage(formData, "logo", "LOGO", "Logo"),
    ]);
  } catch {
    return { error: "Görsel medya kütüphanesine kaydedilemedi." };
  }
  if (!player.ok) return { error: player.error.message };
  if (!logo.ok) return { error: logo.error.message };

  const draft = await createMatchDraft({
    fixtureId,
    format,
    customPrompt: customPrompt || undefined,
    playerPhoto: player.data?.image ?? null,
    logoImageUrl: logo.data?.fileUrl ?? null,
    postId: postId || null,
    renderOptions: { selection: readStatSelection(formData), derbyIntensity: "NONE" },
  });
  if (!draft.ok) return { error: draft.error.message };

  refreshDashboard();
  return { result: { ...draft.data, format, status: "DRAFT" } };
}

/**
 * Kaydı ve ürettiği dosyaları siler. `logoImageUrl` içerik-adresli olduğundan (bkz.
 * `uploads` kovası) başka kayıtlarca paylaşılabilir — silinmez, yalnızca bu kayda özel
 * render, Fal.ai oyuncu kesimi ve arka plan temizlenir.
 */
export async function deleteAiContentAction(id: string): Promise<Result<null>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }

  try {
    const record = await prisma.aiContent.delete({ where: { id } });
    await Promise.all(
      [record.resultImageUrl, record.playerImageUrl, record.backgroundImageUrl].map(deleteStoredUrl),
    );
  } catch (cause) {
    return { ok: false, error: { code: "DELETE_FAILED", message: "Kayıt silinemedi.", cause } };
  }

  refreshDashboard();
  return { ok: true, data: null };
}
