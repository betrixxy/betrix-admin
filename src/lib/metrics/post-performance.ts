import type { PostMetricValues } from "@/types/post-metrics";

/**
 * Türetilmiş performans değerleri — saklanmaz, okurken snapshot'lardan hesaplanır (formül değişirse geçmiş
 * yeniden hesaplanmak zorunda kalmasın). Etkileşim tanımı CLAUDE.md 4.4 ile aynıdır:
 * beğeni + yorum + paylaşım + kaydetme; kitle = erişim, yoksa izlenme/gösterim. Saf fonksiyonlar.
 */

type Values = Pick<PostMetricValues, "likes" | "comments" | "shares" | "saves" | "reach" | "views" | "impressions">;

export function interactionsOf(values: Values): number {
  return (values.likes ?? 0) + (values.comments ?? 0) + (values.shares ?? 0) + (values.saves ?? 0);
}

export function audienceOf(values: Values): number | null {
  return values.reach ?? values.views ?? values.impressions ?? null;
}

/** Erişim başına etkileşim oranı; kitle bilinmiyor/0 ise null. */
export function engagementRateByReach(values: Values): number | null {
  const audience = audienceOf(values);
  return audience ? interactionsOf(values) / audience : null;
}

/** Takipçi başına etkileşim (paylaşım anındaki takipçiye göre normalize). */
export function engagementPerFollower(values: Values, followersAtPublish: number | null): number | null {
  return followersAtPublish ? interactionsOf(values) / followersAtPublish : null;
}

/** İlk 1 saatteki etkileşim hızı (etkileşim/saat): ~1. saat snapshot'ından (yaş ≤ 1.5 sa). */
export const FIRST_HOUR_MAX_AGE = 1.5;

export function firstHourVelocity(snapshots: readonly (Values & { ageHours: number })[]): number | null {
  const early = snapshots.filter((snapshot) => snapshot.ageHours > 0 && snapshot.ageHours <= FIRST_HOUR_MAX_AGE).sort((a, b) => a.ageHours - b.ageHours)[0];
  return early ? interactionsOf(early) / early.ageHours : null;
}
