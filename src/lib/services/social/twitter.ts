import { ApiResponseError, TwitterApi } from "twitter-api-v2";
import type { SocialApiError } from "@/lib/services/social/client";
import type { Result } from "@/types/result";

/**
 * X (Twitter) API v2 ile paylaşım: görseller v2 medya uç noktasına (`/2/media/upload`, OAuth 2.0 kullanıcı
 * token'ı + `media.write`) yüklenir, ardından medya kimlikleriyle tweet atılır (`tweet.write`). Tweet
 * isteği yeniden denenmez — çift paylaşım riskine karşı.
 */

export interface XMedia {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg";
}

/** X'in tweet başına görsel sınırı. */
export const X_MAX_MEDIA = 4;

type MediaIds = [string] | [string, string] | [string, string, string] | [string, string, string, string];

function describe(error: unknown): string {
  if (error instanceof ApiResponseError) {
    const data = error.data as { detail?: string; title?: string };
    return `X API ${error.code}: ${data.detail ?? data.title ?? error.message}`;
  }
  return error instanceof Error ? error.message : "Bilinmeyen hata";
}

function toMediaIds(ids: string[]): MediaIds | null {
  const [a, b, c, d] = ids;
  if (a === undefined) return null;
  if (b === undefined) return [a];
  if (c === undefined) return [a, b];
  if (d === undefined) return [a, b, c];
  return [a, b, c, d];
}

/** Metin + en fazla 4 görsel; başarılıysa tweet kimliği ve bağlantısı. */
export async function publishTweet(accessToken: string, text: string, media: XMedia[]): Promise<Result<{ postId: string; url: string }, SocialApiError>> {
  if (media.length > X_MAX_MEDIA) return { ok: false, error: { code: "HTTP", message: `X tweet başına en fazla ${X_MAX_MEDIA} görsel kabul eder.` } };
  const client = new TwitterApi(accessToken);
  const uploaded: string[] = [];
  try {
    // Sırayla: yükleme sırası tweet'teki görsel sırasıdır.
    for (const item of media) uploaded.push(await client.v2.uploadMedia(item.buffer, { media_type: item.mimeType, media_category: "tweet_image" }));
  } catch (error) {
    return { ok: false, error: { code: "HTTP", message: `Görsel X'e yüklenemedi — ${describe(error)}` } };
  }
  try {
    const mediaIds = toMediaIds(uploaded);
    const result = await client.v2.tweet({ text, ...(mediaIds ? { media: { media_ids: mediaIds } } : {}) });
    return { ok: true, data: { postId: result.data.id, url: `https://x.com/i/web/status/${result.data.id}` } };
  } catch (error) {
    return { ok: false, error: { code: "HTTP", message: `Tweet atılamadı — ${describe(error)}` } };
  }
}
