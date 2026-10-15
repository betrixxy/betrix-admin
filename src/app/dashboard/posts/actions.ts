"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { IMPORT_DEFAULT_COUNT, IMPORT_MAX_COUNT, importPosts } from "@/lib/dashboard/post-import";
import { collectPostMetrics } from "@/lib/metrics/post-metrics";
import { loadTargets } from "@/lib/metrics/snapshot-store";
import type { PostCollectOutcome } from "@/types/post-metrics";
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

const OUTCOME_TEXT: Record<PostCollectOutcome["status"], string> = { OK: "güncellendi", DEFERRED: "ertelendi", ERROR: "hata", BLOCKED: "durduruldu", GONE: "alınamıyor" };

/** "Şimdi güncelle": tek gönderinin (ya da `postId` yoksa tüm gönderilerin) metriklerini hemen çeker — yaş sınırı yok. */
export async function refreshPostMetricsAction(_prev: SocialActionState, formData: FormData): Promise<SocialActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const postId = formData.get("postId");
  const targets = await loadTargets(typeof postId === "string" && postId ? { id: postId } : {});
  if (targets.length === 0) return { error: "Metriği çekilebilecek (platform kimliği olan) gönderi yok." };

  const outcomes = await collectPostMetrics(targets, { trigger: "MANUAL" });
  refreshDashboard();
  const counts = new Map<PostCollectOutcome["status"], number>();
  let firstMessage: string | null = null;
  for (const outcome of outcomes.values()) {
    counts.set(outcome.status, (counts.get(outcome.status) ?? 0) + 1);
    firstMessage ??= outcome.status === "OK" ? null : outcome.status === "DEFERRED" ? outcome.reason : outcome.message;
  }
  const summary = [...counts].map(([status, n]) => `${n} ${OUTCOME_TEXT[status]}`).join(", ");
  const ok = counts.get("OK") ?? 0;
  return ok > 0 ? { success: true, notice: firstMessage ? `${summary}. ${firstMessage}` : summary } : { error: firstMessage ? `${summary}. ${firstMessage}` : summary };
}
