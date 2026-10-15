import { z } from "zod";

/**
 * Instagram Graph API ham (Raw) yanıt şemaları — belgelenmiş biçime birebir. UI ve iş mantığı bu
 * tipleri görmez; `import-mappers.ts` / `metrics/` kanonik tiplere dönüştürür (bkz. CLAUDE.md 1.3.3).
 */

const count = z.coerce.number().int().nonnegative();

export const IG_MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_product_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
  "children{media_type,media_url,thumbnail_url}",
].join(",");

const igChildSchema = z.object({
  id: z.string(),
  media_type: z.string().optional(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

/** `GET /{ig-media-id}?fields=…` ve `/media` listesindeki tek öğe. */
export const igMediaSchema = z.object({
  id: z.string(),
  caption: z.string().optional(),
  /** IMAGE | VIDEO | CAROUSEL_ALBUM */
  media_type: z.string(),
  /** FEED | REELS | STORY | AD */
  media_product_type: z.string().optional(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  permalink: z.string().optional(),
  timestamp: z.string(),
  like_count: count.optional(),
  comments_count: count.optional(),
  children: z.object({ data: z.array(igChildSchema) }).optional(),
});
export type IgMediaRaw = z.infer<typeof igMediaSchema>;

/** `GET /{ig-user-id}/media` — sayfalı. */
export const igMediaListSchema = z.object({
  data: z.array(igMediaSchema),
  paging: z.object({ next: z.string().optional() }).optional(),
});
export type IgMediaListRaw = z.infer<typeof igMediaListSchema>;
