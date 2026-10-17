import type { Prisma } from "@/generated/prisma/client";

/**
 * İçerik planlama (yayın zamanı) — `AiContent.publishAt`. İçerik henüz üretilmemişse plan, görseli
 * olmayan bir DRAFT "placeholder" kaydında tutulur; stüdyo o tür için ilk üretimi bu kaydın
 * üzerine yazar (bkz. match-day-engine.ts). Gerçek taslakların her zaman bir render çıktısı
 * vardır, bu yüzden placeholder = `status: DRAFT` + `resultImageUrl: null`.
 *
 * Placeholder bir taslak değildir: onay kuyruğuna, taslak sayaçlarına ve onay/ret kararına
 * girmez — bu sorgular `WITHOUT_SCHEDULE_PLACEHOLDERS` ile süzülür.
 */
export const SCHEDULE_PLACEHOLDER_WHERE = { status: "DRAFT", resultImageUrl: null } satisfies Prisma.AiContentWhereInput;

/** Placeholder'lar dışındaki tüm kayıtlar (gerçek taslak/onaylı/reddedilen içerik). */
export const WITHOUT_SCHEDULE_PLACEHOLDERS = { NOT: SCHEDULE_PLACEHOLDER_WHERE } satisfies Prisma.AiContentWhereInput;

export function isSchedulePlaceholder(row: { status: string; resultImageUrl: string | null }): boolean {
  return row.status === "DRAFT" && row.resultImageUrl === null;
}
