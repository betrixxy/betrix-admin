import { z } from "zod";

/**
 * X API v2 ham (Raw) yanıt şemaları — belgelenmiş biçime birebir. `non_public_metrics` ve
 * `organic_metrics` yalnızca OAuth 2.0 kullanıcı bağlamında, kendi gönderilerimiz için ve son 30 günde
 * döner; bu yüzden opsiyoneldir.
 */

const count = z.coerce.number().int().nonnegative();

export const xPublicMetricsSchema = z.object({
  retweet_count: count,
  reply_count: count,
  like_count: count,
  quote_count: count,
  bookmark_count: count.optional(),
  impression_count: count.optional(),
});

export const xPrivateMetricsSchema = z.object({
  impression_count: count.optional(),
  url_link_clicks: count.optional(),
  user_profile_clicks: count.optional(),
  engagements: count.optional(),
});

export const xOrganicMetricsSchema = z.object({
  impression_count: count.optional(),
  like_count: count.optional(),
  reply_count: count.optional(),
  retweet_count: count.optional(),
  url_link_clicks: count.optional(),
  user_profile_clicks: count.optional(),
});

export const xTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  created_at: z.string(),
  public_metrics: xPublicMetricsSchema.optional(),
  non_public_metrics: xPrivateMetricsSchema.optional(),
  organic_metrics: xOrganicMetricsSchema.optional(),
  attachments: z.object({ media_keys: z.array(z.string()).optional() }).optional(),
});
export type XTweetRaw = z.infer<typeof xTweetSchema>;

export const xMediaSchema = z.object({
  media_key: z.string(),
  type: z.string(),
  url: z.string().optional(),
  preview_image_url: z.string().optional(),
});
export type XMediaRaw = z.infer<typeof xMediaSchema>;

/** `GET /2/users/:id/tweets` ve `GET /2/tweets?ids=` ortak biçimi (sonuç yoksa `data` gelmez). */
export const xTweetListSchema = z.object({
  data: z.array(xTweetSchema).optional(),
  includes: z.object({ media: z.array(xMediaSchema).optional() }).optional(),
  meta: z.object({ result_count: count.optional(), next_token: z.string().optional() }).optional(),
  errors: z.array(z.object({ detail: z.string().optional(), title: z.string().optional() })).optional(),
});
export type XTweetListRaw = z.infer<typeof xTweetListSchema>;
