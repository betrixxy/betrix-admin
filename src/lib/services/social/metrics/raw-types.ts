import { z } from "zod";

/**
 * Sağlayıcıların gönderi metrik yanıtlarının ham (Raw) şemaları — belgelenmiş yanıt
 * biçimlerine birebir. UI ve iş mantığı bu tipleri görmez; `mappers.ts` kanonik
 * `PostMetricsSnapshot`'a dönüştürür (bkz. CLAUDE.md 1.3.3).
 */

const count = z.coerce.number().int().nonnegative();

/** Meta Graph API `/{id}/insights` — metrik ya `values[0].value` ya da `total_value.value` ile gelir. */
const metaInsightsSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.object({ value: count })).optional(),
      total_value: z.object({ value: count }).optional(),
    }),
  ),
});

/** Instagram: `/{ig-media-id}/insights?metric=likes,comments,shares,saved,reach,views,ig_reels_video_view_total_time` */
export const instagramMetricsRawSchema = metaInsightsSchema;
export type InstagramMetricsRaw = z.infer<typeof instagramMetricsRawSchema>;

/** Facebook: `/{post-id}/insights` + `/{post-id}?fields=comments.summary(true),shares` birleşik. */
export const facebookMetricsRawSchema = z.object({
  insights: metaInsightsSchema,
  comments: z.object({ summary: z.object({ total_count: count }) }).optional(),
  shares: z.object({ count }).optional(),
});
export type FacebookMetricsRaw = z.infer<typeof facebookMetricsRawSchema>;

/** TikTok Display API `POST /v2/video/query/` — kaydetme/erişim bu API'de yok. */
export const tiktokMetricsRawSchema = z.object({
  data: z.object({
    videos: z.array(
      z.object({
        id: z.string(),
        like_count: count.optional(),
        comment_count: count.optional(),
        share_count: count.optional(),
        view_count: count.optional(),
      }),
    ),
  }),
});
export type TiktokMetricsRaw = z.infer<typeof tiktokMetricsRawSchema>;

/**
 * YouTube Data API `videos.list?part=statistics` (sayılar string gelir) + isteğe bağlı
 * Analytics API `reports.query?metrics=estimatedMinutesWatched,shares` satırı.
 */
export const youtubeMetricsRawSchema = z.object({
  video: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        statistics: z.object({
          viewCount: count.optional(),
          likeCount: count.optional(),
          commentCount: count.optional(),
          favoriteCount: count.optional(),
        }),
      }),
    ),
  }),
  analytics: z
    .object({
      columnHeaders: z.array(z.object({ name: z.string() })),
      rows: z.array(z.array(z.number())).optional(),
    })
    .optional(),
});
export type YoutubeMetricsRaw = z.infer<typeof youtubeMetricsRawSchema>;

/** X API v2 `GET /2/tweets/:id?tweet.fields=public_metrics,non_public_metrics` */
export const xMetricsRawSchema = z.object({
  data: z.object({
    id: z.string(),
    public_metrics: z.object({
      retweet_count: count,
      reply_count: count,
      like_count: count,
      quote_count: count,
      bookmark_count: count.optional(),
      impression_count: count.optional(),
    }),
    non_public_metrics: z
      .object({ impression_count: count.optional(), user_profile_clicks: count.optional() })
      .optional(),
  }),
});
export type XMetricsRaw = z.infer<typeof xMetricsRawSchema>;
