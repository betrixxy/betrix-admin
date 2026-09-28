"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { decideDraft, regenerateDraftBackground, updateDraft } from "@/lib/dashboard/draft-engine";
import { derbyIntensitySchema } from "@/lib/dashboard/draft-snapshot";
import { readStatSelection } from "@/lib/dashboard/studio-stats";
import { isFalConfigured } from "@/lib/services/fal";
import type { DraftActionState, DraftRenderOptions } from "@/types/draft";

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

/** Onayla / Reddet — onayda isteğe bağlı olarak bir gönderiye bağlanır. */
export async function decideDraftAction(_prev: DraftActionState, formData: FormData): Promise<DraftActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };

  const id = readId(formData);
  const decision = decisionSchema.safeParse(formData.get("decision"));
  if (!id || !decision.success) return { error: "Geçersiz karar." };

  const postId = decision.data === "APPROVED" ? String(formData.get("postId") ?? "") : undefined;
  const result = await decideDraft(id, decision.data, postId);
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { notice: decision.data === "APPROVED" ? "Onaylandı — içerik yayına hazır." : "Taslak reddedildi." };
}
