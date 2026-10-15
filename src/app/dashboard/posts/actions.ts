"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { IMPORT_DEFAULT_COUNT, IMPORT_MAX_COUNT, importPosts } from "@/lib/dashboard/post-import";
import { IMPORT_PLATFORMS, type SocialActionState } from "@/types/social";

const importSchema = z.object({
  platform: z.enum(IMPORT_PLATFORMS),
  count: z.coerce.number().int().min(1, "En az 1 gönderi.").max(IMPORT_MAX_COUNT, `En fazla ${IMPORT_MAX_COUNT} gönderi.`).default(IMPORT_DEFAULT_COUNT),
});

/** "Geçmiş gönderileri içe aktar" — admin tıklamasıyla, yalnızca okuma (bkz. CLAUDE.md 1.10). */
export async function importPostsAction(_prev: SocialActionState, formData: FormData): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = importSchema.safeParse({ platform: formData.get("platform"), count: formData.get("count") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };

  const result = await importPosts(parsed.data.platform, parsed.data.count);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  const report = result.data;
  const parts = [`${PLATFORM_LABELS[report.platform]}: ${report.fetched} gönderi okundu, ${report.created} yeni eklendi, ${report.skipped} zaten kayıtlıydı.`];
  if (report.linkedDrafts > 0) parts.push(`${report.linkedDrafts} paylaşılmış taslak gönderisine bağlandı.`);
  if (report.limitedBy) parts.push(report.limitedBy);
  return { success: true, notice: parts.join(" ") };
}
