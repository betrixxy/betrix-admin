import { z } from "zod";
import { igInsightValue } from "@/lib/services/social/metrics/post-mappers";
import type { IgInsightsRaw } from "@/lib/services/social/instagram-raw";
import { emptyAccountValues, type AccountMetricValues, type AudienceBuckets } from "@/types/account-metrics";

/** Hesap düzeyi ham yanıtlar → kanonik değerler. Saf fonksiyonlar; yan etki yok. */

const count = z.coerce.number().int().nonnegative();

/** `GET /{ig-user-id}?fields=followers_count,follows_count,media_count` */
export const igUserCountsSchema = z.object({
  id: z.string(),
  followers_count: count.optional(),
  follows_count: count.optional(),
  media_count: count.optional(),
});
export type IgUserCountsRaw = z.infer<typeof igUserCountsSchema>;

/** `GET /2/users/me?user.fields=public_metrics` */
export const xMeMetricsSchema = z.object({
  data: z.object({
    id: z.string(),
    username: z.string().optional(),
    public_metrics: z
      .object({ followers_count: count, following_count: count, tweet_count: count.optional(), listed_count: count.optional() })
      .optional(),
  }),
});
export type XMeMetricsRaw = z.infer<typeof xMeMetricsSchema>;

/** Günlük Instagram hesap metrikleri: profil sayaçları + `total_value` insights (+ takip/takipten çıkma kırılımı). */
export function mapIgAccountDaily(counts: IgUserCountsRaw | null, insights: IgInsightsRaw | null, follows: { follows: number | null; unfollows: number | null }): AccountMetricValues {
  const value = (name: string) => (insights ? igInsightValue(insights, name) : null);
  return {
    ...emptyAccountValues(),
    followerCount: counts?.followers_count ?? null,
    followingCount: counts?.follows_count ?? null,
    mediaCount: counts?.media_count ?? null,
    reach: value("reach"),
    views: value("views"),
    accountsEngaged: value("accounts_engaged"),
    totalInteractions: value("total_interactions"),
    likes: value("likes"),
    comments: value("comments"),
    shares: value("shares"),
    saves: value("saves"),
    profileLinksTaps: value("profile_links_taps"),
    follows: follows.follows,
    unfollows: follows.unfollows,
  };
}

export function mapXAccountDaily(raw: XMeMetricsRaw): AccountMetricValues {
  const metrics = raw.data.public_metrics;
  return {
    ...emptyAccountValues(),
    followerCount: metrics?.followers_count ?? null,
    followingCount: metrics?.following_count ?? null,
    mediaCount: metrics?.tweet_count ?? null,
  };
}

/** Kırılımlı `total_value`: `{ breakdowns: [{ dimension_keys, results: [{ dimension_values, value }] }] }`. */
const breakdownSchema = z.object({
  breakdowns: z
    .array(
      z.object({
        dimension_keys: z.array(z.string()).optional(),
        results: z.array(z.object({ dimension_values: z.array(z.string()), value: z.coerce.number() })).optional(),
      }),
    )
    .optional(),
});

/** Bir metriğin kırılım sonuçlarını kova → sayı biçimine çevirir; veri yoksa `null`. */
export function parseBreakdownBuckets(raw: IgInsightsRaw, metric: string): AudienceBuckets | null {
  const item = raw.data.find((entry) => entry.name === metric);
  const parsed = breakdownSchema.safeParse(item?.total_value ?? {});
  if (!parsed.success) return null;
  const buckets: AudienceBuckets = {};
  for (const breakdown of parsed.data.breakdowns ?? []) {
    for (const result of breakdown.results ?? []) {
      const key = result.dimension_values.join(" / ");
      if (key) buckets[key] = (buckets[key] ?? 0) + Math.round(result.value);
    }
  }
  return Object.keys(buckets).length > 0 ? buckets : null;
}

/** `follows_and_unfollows` kırılımı (`follow_type`: FOLLOWER / NON_FOLLOWER). */
export function parseFollowsUnfollows(raw: IgInsightsRaw): { follows: number | null; unfollows: number | null } {
  const buckets = parseBreakdownBuckets(raw, "follows_and_unfollows");
  if (!buckets) return { follows: null, unfollows: null };
  return { follows: buckets.FOLLOWER ?? 0, unfollows: buckets.NON_FOLLOWER ?? 0 };
}

/**
 * `follower_count` (period=day, time_series): o gün kazanılan YENİ takipçi sayısı — toplam değil, takipten
 * çıkmaları da düşmez. Bu yüzden geriye dönük doldurmada toplam takipçi türetilmez, yalnızca `follows` yazılır.
 */
export function parseFollowerSeries(raw: IgInsightsRaw): { endTime: string; value: number }[] {
  const item = raw.data.find((entry) => entry.name === "follower_count");
  return (item?.values ?? []).flatMap((point) =>
    typeof point.value === "number" && point.end_time ? [{ endTime: point.end_time, value: Math.round(point.value) }] : [],
  );
}
