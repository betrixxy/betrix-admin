/**
 * Gönderi metrik zaman serisinin kanonik tipleri (bkz. CLAUDE.md 4.4). Ham sağlayıcı yanıtlarını
 * `lib/services/social/metrics/post-mappers.ts` bu biçime dönüştürür; `null` = platform vermedi.
 */

export const POST_METRIC_FIELDS = [
  "likes",
  "comments",
  "shares",
  "saves",
  "reach",
  "views",
  "impressions",
  "profileVisits",
  "follows",
  "linkClicks",
  "profileClicks",
  "reposts",
  "quotes",
  "replies",
  "bookmarks",
  "totalInteractions",
  "watchTimeSeconds",
] as const;
export type PostMetricField = (typeof POST_METRIC_FIELDS)[number];

export type PostMetricValues = Record<PostMetricField, number | null>;

export type MetricLevel = "PUBLIC" | "PRIVATE";
export type MetricTrigger = "SCHEDULED" | "MANUAL" | "IMPORT";

export interface MappedPostMetrics {
  values: PostMetricValues;
  metricLevel: MetricLevel | null;
}

export function emptyMetricValues(): PostMetricValues {
  return Object.fromEntries(POST_METRIC_FIELDS.map((field) => [field, null])) as PostMetricValues;
}

/** Tek gönderi için çekim sonucu — iş kuyruğu (`MetricJob`) bu sonuca göre yeniden dener ya da bırakır. */
export type PostCollectOutcome =
  | { status: "OK" }
  /** Bu sefer çekilmedi, sonra tekrar denenebilir (kredi sınırı, 1 saatten sık çekme). */
  | { status: "DEFERRED"; reason: string; until?: Date }
  /** Geçici hata — üstel beklemeyle yeniden denenir. */
  | { status: "ERROR"; message: string }
  /** Kalıcı: token/bağlantı sorunu — yeniden bağlanana kadar durur. */
  | { status: "BLOCKED"; message: string }
  /** Kalıcı: gönderi silinmiş, story süresi dolmuş vb. — bir daha denenmez. */
  | { status: "GONE"; message: string };

export interface PostCollectReport {
  outcomes: Map<string, PostCollectOutcome>;
}
