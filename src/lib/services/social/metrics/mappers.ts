import type { z } from "zod";
import {
  facebookMetricsRawSchema,
  instagramMetricsRawSchema,
  tiktokMetricsRawSchema,
  xMetricsRawSchema,
  youtubeMetricsRawSchema,
  type FacebookMetricsRaw,
  type InstagramMetricsRaw,
  type TiktokMetricsRaw,
  type XMetricsRaw,
  type YoutubeMetricsRaw,
} from "@/lib/services/social/metrics/raw-types";
import type { Result } from "@/types/result";
import type { SocialPlatformType } from "@/types/social";
import type { PostMetricsSnapshot } from "@/types/social-connection";

/** Ham sağlayıcı yanıtı → kanonik `PostMetricsSnapshot`. Saf fonksiyonlar; yan etki yok. */

const EMPTY: Omit<PostMetricsSnapshot, "providerPostId"> = {
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  views: 0,
  reach: 0,
  impressions: 0,
  watchTimeSeconds: 0,
};

function insightValue(raw: InstagramMetricsRaw, name: string): number {
  const metric = raw.data.find((item) => item.name === name);
  return metric?.total_value?.value ?? metric?.values?.[0]?.value ?? 0;
}

export function mapInstagramMetrics(providerPostId: string, raw: InstagramMetricsRaw): PostMetricsSnapshot {
  return {
    ...EMPTY,
    providerPostId,
    likes: insightValue(raw, "likes"),
    comments: insightValue(raw, "comments"),
    shares: insightValue(raw, "shares"),
    saves: insightValue(raw, "saved"),
    reach: insightValue(raw, "reach"),
    views: insightValue(raw, "views"),
    impressions: insightValue(raw, "views"),
    // Graph API toplam izlenme süresini milisaniye verir.
    watchTimeSeconds: Math.round(insightValue(raw, "ig_reels_video_view_total_time") / 1000),
  };
}

export function mapFacebookMetrics(providerPostId: string, raw: FacebookMetricsRaw): PostMetricsSnapshot {
  return {
    ...EMPTY,
    providerPostId,
    likes: insightValue(raw.insights, "post_reactions_like_total"),
    comments: raw.comments?.summary.total_count ?? 0,
    shares: raw.shares?.count ?? 0,
    reach: insightValue(raw.insights, "post_impressions_unique"),
    impressions: insightValue(raw.insights, "post_impressions"),
    views: insightValue(raw.insights, "post_video_views"),
  };
}

export function mapTiktokMetrics(providerPostId: string, raw: TiktokMetricsRaw): PostMetricsSnapshot | null {
  const video = raw.data.videos.find((item) => item.id === providerPostId);
  if (!video) return null;
  return {
    ...EMPTY,
    providerPostId,
    likes: video.like_count ?? 0,
    comments: video.comment_count ?? 0,
    shares: video.share_count ?? 0,
    views: video.view_count ?? 0,
  };
}

export function mapYoutubeMetrics(providerPostId: string, raw: YoutubeMetricsRaw): PostMetricsSnapshot | null {
  const video = raw.video.items.find((item) => item.id === providerPostId);
  if (!video) return null;

  const headers = raw.analytics?.columnHeaders.map((header) => header.name) ?? [];
  const row = raw.analytics?.rows?.[0] ?? [];
  const column = (name: string) => {
    const index = headers.indexOf(name);
    return index >= 0 ? (row[index] ?? 0) : 0;
  };

  return {
    ...EMPTY,
    providerPostId,
    views: video.statistics.viewCount ?? 0,
    likes: video.statistics.likeCount ?? 0,
    comments: video.statistics.commentCount ?? 0,
    saves: video.statistics.favoriteCount ?? 0,
    shares: column("shares"),
    watchTimeSeconds: Math.round(column("estimatedMinutesWatched") * 60),
  };
}

export function mapXMetrics(providerPostId: string, raw: XMetricsRaw): PostMetricsSnapshot | null {
  if (raw.data.id !== providerPostId) return null;
  const metrics = raw.data.public_metrics;
  const impressions = raw.data.non_public_metrics?.impression_count ?? metrics.impression_count ?? 0;
  return {
    ...EMPTY,
    providerPostId,
    likes: metrics.like_count,
    comments: metrics.reply_count,
    // X'te paylaşım = yeniden paylaşım + alıntı.
    shares: metrics.retweet_count + metrics.quote_count,
    saves: metrics.bookmark_count ?? 0,
    impressions,
    // X metin gönderilerinde "izlenme" gösterimdir.
    views: impressions,
  };
}

function parseWith<Schema extends z.ZodType, Out>(
  schema: Schema,
  payload: unknown,
  map: (raw: z.infer<Schema>) => Out | null,
): Result<Out, string> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Sağlayıcı yanıtı beklenen şemaya uymuyor." };
  const mapped = map(parsed.data);
  return mapped ? { ok: true, data: mapped } : { ok: false, error: "Yanıtta gönderi bulunamadı." };
}

/** Platforma göre doğru şemayla ayrıştırıp eşler — `fetchers.ts`'in tek giriş noktası. */
export function mapPostMetrics(
  platform: SocialPlatformType,
  providerPostId: string,
  payload: unknown,
): Result<PostMetricsSnapshot, string> {
  switch (platform) {
    case "META_INSTAGRAM":
      return parseWith(instagramMetricsRawSchema, payload, (raw) => mapInstagramMetrics(providerPostId, raw));
    case "META_FACEBOOK":
      return parseWith(facebookMetricsRawSchema, payload, (raw) => mapFacebookMetrics(providerPostId, raw));
    case "TIKTOK":
      return parseWith(tiktokMetricsRawSchema, payload, (raw) => mapTiktokMetrics(providerPostId, raw));
    case "YOUTUBE":
      return parseWith(youtubeMetricsRawSchema, payload, (raw) => mapYoutubeMetrics(providerPostId, raw));
    case "X":
      return parseWith(xMetricsRawSchema, payload, (raw) => mapXMetrics(providerPostId, raw));
  }
}
