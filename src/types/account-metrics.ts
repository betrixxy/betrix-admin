/** Hesap düzeyi metriklerin kanonik tipleri (bkz. CLAUDE.md 4.4); `null` = platform vermedi. */

export const ACCOUNT_METRIC_FIELDS = [
  "followerCount",
  "followingCount",
  "mediaCount",
  "reach",
  "views",
  "accountsEngaged",
  "totalInteractions",
  "likes",
  "comments",
  "shares",
  "saves",
  "profileLinksTaps",
  "follows",
  "unfollows",
] as const;
export type AccountMetricField = (typeof ACCOUNT_METRIC_FIELDS)[number];
export type AccountMetricValues = Record<AccountMetricField, number | null>;

export function emptyAccountValues(): AccountMetricValues {
  return Object.fromEntries(ACCOUNT_METRIC_FIELDS.map((field) => [field, null])) as AccountMetricValues;
}

export const AUDIENCE_BREAKDOWNS = ["age", "gender", "city", "country"] as const;
export type AudienceBreakdown = (typeof AUDIENCE_BREAKDOWNS)[number];
export const AUDIENCE_TIMEFRAMES = ["this_week", "this_month"] as const;
export type AudienceTimeframe = (typeof AUDIENCE_TIMEFRAMES)[number];
export type AudienceKind = "FOLLOWER" | "ENGAGED";

/** Kova → sayı, ör. { "18-24": 120 }. */
export type AudienceBuckets = Record<string, number>;
