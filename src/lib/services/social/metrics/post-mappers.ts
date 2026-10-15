import type { IgInsightsRaw, IgMediaRaw } from "@/lib/services/social/instagram-raw";
import type { XTweetRaw } from "@/lib/services/social/x-raw";
import { emptyMetricValues, type MappedPostMetrics } from "@/types/post-metrics";
import type { PostMediaType } from "@/types/social";

/**
 * Ham gönderi metrikleri → kanonik `PostMetricValues`. Saf fonksiyonlar; yan etki yok.
 *
 * Instagram metrik listeleri medya türüne göre farklıdır ve güncel Graph API belgesine göre seçilmiştir
 * (developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights, 2026-10):
 * `impressions` 2024-07-02 sonrası medyada kaldırıldı — istenmez, yerine `views`.
 */

const IG_FEED_METRICS = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions", "profile_visits", "follows"] as const;
const IG_REELS_METRICS = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions", "ig_reels_video_view_total_time"] as const;
const IG_STORY_METRICS = ["reach", "views", "shares", "total_interactions", "profile_visits", "follows", "replies", "link_clicks"] as const;
/** Tam liste reddedilirse (ör. eski medya, eşik altı değer) denenen asgari liste. */
export const IG_CORE_METRICS = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"] as const;
export const IG_STORY_CORE_METRICS = ["reach", "views"] as const;

export function igMetricList(mediaType: PostMediaType | null): readonly string[] {
  if (mediaType === "STORY") return IG_STORY_METRICS;
  if (mediaType === "REELS") return IG_REELS_METRICS;
  return IG_FEED_METRICS;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function igInsightValue(raw: IgInsightsRaw, name: string): number | null {
  const metric = raw.data.find((item) => item.name === name);
  if (!metric) return null;
  return numeric(metric.total_value?.value) ?? numeric(metric.values?.[0]?.value);
}

export function mapIgInsights(raw: IgInsightsRaw): MappedPostMetrics {
  const value = (name: string) => igInsightValue(raw, name);
  const watchMs = value("ig_reels_video_view_total_time");
  return {
    values: {
      ...emptyMetricValues(),
      likes: value("likes"),
      comments: value("comments"),
      shares: value("shares"),
      saves: value("saved"),
      reach: value("reach"),
      views: value("views"),
      profileVisits: value("profile_visits"),
      follows: value("follows"),
      replies: value("replies"),
      linkClicks: value("link_clicks"),
      totalInteractions: value("total_interactions"),
      // Graph API toplam izlenme süresini milisaniye verir.
      watchTimeSeconds: watchMs === null ? null : Math.round(watchMs / 1000),
    },
    metricLevel: null,
  };
}

/** İçe aktarma anında medya nesnesinde gelen sayaçlar (insights çağrısı yapılmadan). */
export function mapIgMediaCounts(raw: Pick<IgMediaRaw, "like_count" | "comments_count">): MappedPostMetrics {
  return { values: { ...emptyMetricValues(), likes: raw.like_count ?? null, comments: raw.comments_count ?? null }, metricLevel: null };
}

export function mapXTweetMetrics(raw: XTweetRaw): MappedPostMetrics {
  const pub = raw.public_metrics;
  const priv = raw.non_public_metrics;
  const organic = raw.organic_metrics;
  const hasPrivate = priv !== undefined || organic !== undefined;
  const impressions = priv?.impression_count ?? organic?.impression_count ?? pub?.impression_count ?? null;
  const reposts = pub?.retweet_count ?? null;
  const quotes = pub?.quote_count ?? null;
  return {
    values: {
      ...emptyMetricValues(),
      likes: pub?.like_count ?? null,
      // X'te yorum = yanıt.
      comments: pub?.reply_count ?? null,
      replies: pub?.reply_count ?? null,
      reposts,
      quotes,
      // Paylaşım = yeniden paylaşım + alıntı.
      shares: reposts === null && quotes === null ? null : (reposts ?? 0) + (quotes ?? 0),
      bookmarks: pub?.bookmark_count ?? null,
      saves: pub?.bookmark_count ?? null,
      impressions,
      // X metin gönderilerinde "izlenme" gösterimdir; erişim (tekil hesap) X'te yok.
      views: impressions,
      linkClicks: priv?.url_link_clicks ?? organic?.url_link_clicks ?? null,
      profileClicks: priv?.user_profile_clicks ?? organic?.user_profile_clicks ?? null,
      totalInteractions: priv?.engagements ?? null,
    },
    metricLevel: pub === undefined && !hasPrivate ? null : hasPrivate ? "PRIVATE" : "PUBLIC",
  };
}
