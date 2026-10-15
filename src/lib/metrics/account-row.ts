import { dayToDbDate } from "@/lib/metrics/istanbul-time";
import type { AccountMetricValues } from "@/types/account-metrics";
import type { SocialPlatformType } from "@/types/social";

/**
 * `AccountMetricSnapshot` upsert argümanları — saf. Anahtar (platform, İstanbul günü) olduğu için aynı gün
 * içinde tekrar çalışan iş yeni satır açmaz, o günün satırını günceller.
 */
export function accountUpsertArgs(platform: SocialPlatformType, day: string, values: AccountMetricValues, raw: unknown, now: Date) {
  const data = { ...values, capturedAt: now, backfilled: false, raw: JSON.parse(JSON.stringify(raw ?? null)) as unknown };
  return {
    where: { platform_date: { platform, date: dayToDbDate(day) } },
    update: data,
    create: { platform, date: dayToDbDate(day), ...data },
  };
}
