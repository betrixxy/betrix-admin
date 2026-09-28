"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createMatchDraft } from "@/lib/dashboard/draft-engine";
import { DEFAULT_STAT_SELECTION } from "@/lib/dashboard/studio-stats";
import { isFalConfigured } from "@/lib/services/fal";
import { STUDIO_FORMATS } from "@/types/ai-content";
import type { DraftActionState } from "@/types/draft";

const generateSchema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Geçersiz maç."),
  format: z.enum(STUDIO_FORMATS, "Bir format seçin."),
});

/**
 * Maç Merkezi'ndeki "AI İçerik Üret" butonu — kendi kendine çalışan bir zamanlayıcı yoktur,
 * her üretim bu aksiyonla admin tarafından tetiklenir (bkz. CLAUDE.md 1.10). Başarılı üretimde
 * doğrudan taslak inceleme ekranına yönlendirir.
 */
export async function generateMatchDraftAction(
  _prevState: DraftActionState,
  formData: FormData,
): Promise<DraftActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!isFalConfigured()) return { error: "FAL_KEY tanımlı değil — görsel üretilemiyor." };

  const parsed = generateSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    format: formData.get("format"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };

  const draft = await createMatchDraft({
    ...parsed.data,
    renderOptions: { selection: DEFAULT_STAT_SELECTION, derbyIntensity: "NONE" },
  });
  if (!draft.ok) return { error: draft.error.message };

  refreshDashboard();
  redirect(`/dashboard/drafts/${draft.data.id}`);
}
