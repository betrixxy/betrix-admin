import type { IgMediaRaw } from "@/lib/services/social/instagram-raw";
import type { XMediaRaw, XTweetListRaw, XTweetRaw } from "@/lib/services/social/x-raw";
import type { ImportedPost, PostMediaType } from "@/types/social";

/** Ham platform gönderisi → kanonik `ImportedPost`. Saf fonksiyonlar; yan etki yok. */

export function igMediaType(raw: Pick<IgMediaRaw, "media_type" | "media_product_type">): PostMediaType {
  if (raw.media_product_type === "STORY") return "STORY";
  if (raw.media_product_type === "REELS") return "REELS";
  if (raw.media_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (raw.media_type === "VIDEO") return "VIDEO";
  return "IMAGE";
}

export function mapInstagramMedia(raw: IgMediaRaw): ImportedPost | null {
  const publishedAt = new Date(raw.timestamp);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const children = raw.children?.data ?? [];
  const mediaUrls = (children.length > 0 ? children.map((child) => child.media_url ?? child.thumbnail_url) : [raw.media_url ?? raw.thumbnail_url]).filter(
    (url): url is string => typeof url === "string",
  );
  return {
    platform: "META_INSTAGRAM",
    providerPostId: raw.id,
    caption: raw.caption ?? "",
    publishedAt,
    permalink: raw.permalink ?? null,
    mediaType: igMediaType(raw),
    // Videoda `media_url` video dosyasıdır; küçük görsel `thumbnail_url`.
    thumbnailUrl: raw.thumbnail_url ?? (raw.media_type === "VIDEO" ? null : (raw.media_url ?? mediaUrls[0] ?? null)),
    mediaUrls,
  };
}

export function xPermalink(username: string | null, tweetId: string): string {
  return username ? `https://x.com/${username}/status/${tweetId}` : `https://x.com/i/web/status/${tweetId}`;
}

function xMediaType(media: XMediaRaw[]): PostMediaType {
  if (media.length === 0) return "TEXT";
  if (media.length > 1) return "CAROUSEL";
  return media[0]?.type === "photo" ? "IMAGE" : "VIDEO";
}

export function mapXTweet(raw: XTweetRaw, mediaByKey: ReadonlyMap<string, XMediaRaw>, username: string | null): ImportedPost | null {
  const publishedAt = new Date(raw.created_at);
  if (Number.isNaN(publishedAt.getTime())) return null;
  const media = (raw.attachments?.media_keys ?? []).map((key) => mediaByKey.get(key)).filter((item): item is XMediaRaw => item !== undefined);
  const mediaUrls = media.map((item) => item.url ?? item.preview_image_url).filter((url): url is string => typeof url === "string");
  return {
    platform: "X",
    providerPostId: raw.id,
    caption: raw.text,
    publishedAt,
    permalink: xPermalink(username, raw.id),
    mediaType: xMediaType(media),
    thumbnailUrl: mediaUrls[0] ?? null,
    mediaUrls,
  };
}

export function mapXTweetList(raw: XTweetListRaw, username: string | null): ImportedPost[] {
  const mediaByKey = new Map((raw.includes?.media ?? []).map((item) => [item.media_key, item]));
  return (raw.data ?? []).map((tweet) => mapXTweet(tweet, mediaByKey, username)).filter((post): post is ImportedPost => post !== null);
}

/**
 * İçe aktarma idempotent: aynı `providerPostId` zaten kayıtlıysa tekrar eklenmez; aynı yanıtta iki kez
 * gelen gönderi de bir kez sayılır.
 */
export function planImport(existingIds: ReadonlySet<string>, posts: readonly ImportedPost[]): { toCreate: ImportedPost[]; skipped: number } {
  const seen = new Set(existingIds);
  const toCreate: ImportedPost[] = [];
  let skipped = 0;
  for (const post of posts) {
    if (seen.has(post.providerPostId)) {
      skipped += 1;
      continue;
    }
    seen.add(post.providerPostId);
    toCreate.push(post);
  }
  return { toCreate, skipped };
}
