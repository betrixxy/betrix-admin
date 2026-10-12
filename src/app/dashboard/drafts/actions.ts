"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { decideDraft, regenerateDraftBackground, updateDraft, type PublishDecision } from "@/lib/dashboard/draft-engine";
import { derbyIntensitySchema } from "@/lib/dashboard/draft-snapshot";
import { readStatSelection } from "@/lib/dashboard/studio-stats";
import { isFalConfigured } from "@/lib/services/fal";
import { captionLength } from "@/lib/dashboard/publish-caption";
import { generateDraftCaption } from "@/lib/dashboard/publish-engine";
import type { DraftActionState, DraftRenderOptions } from "@/types/draft";
import { GALLERY_MAX_PICK, PUBLISH_LAYOUTS, PUBLISH_PLATFORM_DEFS, PUBLISH_PLATFORMS, type CaptionDraft } from "@/types/publishing";
import type { Result } from "@/types/result";

/**
 * Taslak inceleme ekranının aksiyonları (bkz. CLAUDE.md 1.10). Hepsi oturumu kendisi
 * doğrular ve yalnızca DRAFT durumundaki kayıtlara uygulanır (motor tarafında zorunlu).
 */

const idSchema = z.string().min(1).max(64);
const captionSchema = z.string().trim().min(1, "Gönderi metni boş olamaz.").max(2200, "Metin en fazla 2200 karakter olabilir.");
const promptSchema = z.string().trim().max(1000, "Özel prompt en fazla 1000 karakter olabilir.");

function readRenderOptions(formData: FormData): DraftRenderOptions | null {
  const derby = derbyIntensitySchema.safeParse(formData.get("derbyIntensity"));
  return derby.success ? { selection: readStatSelection(formData), derbyIntensity: derby.data } : null;
}

function readId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

/** Metni ve görsel ayarlarını kaydeder, görseli Fal.ai'siz (ücretsiz) yeniden çizer. */
export async function updateDraftAction(_prev: DraftActionState, formData: FormData): Promise<DraftActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const id = readId(formData);
  const caption = captionSchema.safeParse(formData.get("caption"));
  const renderOptions = readRenderOptions(formData);
  if (!id || !renderOptions) return { error: "Geçersiz form verisi." };
  if (!caption.success) return { error: caption.error.issues[0]?.message ?? "Geçersiz metin." };

  const result = await updateDraft(id, { caption: caption.data, renderOptions });
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { notice: "Kaydedildi — görsel yeniden çizildi." };
}

/** Arka planı Fal.ai ile yeniden üretir (ücretli); istatistik ve metin korunur. */
export async function regenerateBackgroundAction(_prev: DraftActionState, formData: FormData): Promise<DraftActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!isFalConfigured()) return { error: "FAL_KEY tanımlı değil — arka plan üretilemiyor." };

  const id = readId(formData);
  const caption = captionSchema.safeParse(formData.get("caption"));
  const prompt = promptSchema.safeParse(formData.get("customPrompt") ?? "");
  const renderOptions = readRenderOptions(formData);
  if (!id || !renderOptions) return { error: "Geçersiz form verisi." };
  if (!caption.success) return { error: caption.error.issues[0]?.message ?? "Geçersiz metin." };
  if (!prompt.success) return { error: prompt.error.issues[0]?.message ?? "Geçersiz prompt." };

  const result = await regenerateDraftBackground(id, {
    caption: caption.data,
    customPrompt: prompt.data || undefined,
    renderOptions,
  });
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { notice: "Yeni arka plan üretildi." };
}

const decisionSchema = z.enum(["APPROVED", "REJECTED"]);

const platformSchema = z.enum(PUBLISH_PLATFORMS);
const publishSchema = z.object({
  platform: platformSchema,
  layout: z.enum(PUBLISH_LAYOUTS),
  mediaOrder: z.array(z.string().max(500)).min(1).max(GALLERY_MAX_PICK + 1),
  caption: captionSchema,
});

/** Yayın Merkezi alanları (varsa): platform, düzen, görsel dizilimi (JSON) ve son metin. */
function readPublish(formData: FormData): { ok: true; data: PublishDecision | undefined } | { ok: false; error: string } {
  if (!formData.get("platform")) return { ok: true, data: undefined };
  let mediaOrder: unknown;
  try {
    mediaOrder = JSON.parse(String(formData.get("mediaOrder") ?? "[]"));
  } catch {
    return { ok: false, error: "Görsel dizilimi okunamadı." };
  }
  const parsed = publishSchema.safeParse({ platform: formData.get("platform"), layout: formData.get("layout"), mediaOrder, caption: formData.get("caption") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yayın ayarları geçersiz." };
  const { caption, ...settings } = parsed.data;
  const limit = PUBLISH_PLATFORM_DEFS[settings.platform].captionLimit;
  if (captionLength(caption, settings.platform) > limit) return { ok: false, error: `${PUBLISH_PLATFORM_DEFS[settings.platform].label} metni en fazla ${limit} karakter olabilir.` };
  return { ok: true, data: { settings, caption } };
}

/** Yayın Merkezi: seçilen platform için metni Claude ile yazar (ücretli — yalnızca admin tıklamasıyla). */
export async function generateCaptionAction(id: unknown, platform: unknown): Promise<Result<CaptionDraft>> {
  if (!(await getCurrentSession())) return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  const parsedId = idSchema.safeParse(id);
  const parsedPlatform = platformSchema.safeParse(platform);
  if (!parsedId.success || !parsedPlatform.success) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz taslak ya da platform." } };
  return generateDraftCaption(parsedId.data, parsedPlatform.data);
}

/** Onayla / Reddet — onayda isteğe bağlı olarak bir gönderiye bağlanır; Yayın Merkezi seçimleri kayda işlenir. */
export async function decideDraftAction(_prev: DraftActionState, formData: FormData): Promise<DraftActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const id = readId(formData);
  const decision = decisionSchema.safeParse(formData.get("decision"));
  if (!id || !decision.success) return { error: "Geçersiz karar." };

  const publish = decision.data === "APPROVED" ? readPublish(formData) : ({ ok: true, data: undefined } as const);
  if (!publish.ok) return { error: publish.error };
  const postId = decision.data === "APPROVED" ? String(formData.get("postId") ?? "") : undefined;
  const result = await decideDraft(id, decision.data, postId, publish.data);
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { notice: decision.data === "APPROVED" ? "Onaylandı — içerik yayına hazır." : "Taslak reddedildi." };
}
