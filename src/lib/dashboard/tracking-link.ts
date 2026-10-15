import { POST_ATTRIBUTION_PARAM } from "@/lib/dashboard/tracker-snippet";
import type { SocialPlatformType } from "@/types/social";

/**
 * Gönderi başına checkmatch.net hedef adresi — CLAUDE.md 4.3 UTM standardı. Kısa link (`/r/<kod>`) bu adrese
 * yönlendirir; linkler yalnızca bu fonksiyondan üretilir, elle string birleştirme yapılmaz.
 *
 * `cm_post` de eklenir: checkmatch.net'teki eski izleme kodu UTM'i okumaz ama `cm_post`'u okur — snippet
 * güncellenene kadar atıf yine çalışır (bkz. docs/checkmatch-net-tracking-changes.md).
 */

export const CHECKMATCH_BASE_URL = "https://checkmatch.net";

export const UTM_SOURCE: Record<SocialPlatformType, string> = {
  META_INSTAGRAM: "instagram",
  META_FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  X: "x",
};

/** `utm_campaign`: içerik türü kimliği, küçük harf (ör. MATCH_DAY → match_day); bilinmiyorsa `post`. */
export function campaignOf(contentType: string | null): string {
  const value = (contentType ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return value || "post";
}

export interface TrackingLinkInput {
  /** `utm_content` — tıklamayı gönderiye bağlar; henüz paylaşılmamış taslakta yok. */
  socialPostId: string | null;
  platform: SocialPlatformType;
  contentType: string | null;
  /** checkmatch.net'teki hedef yol — varsayılan ana sayfa. Yalnızca site içi göreli yol kabul edilir. */
  path?: string;
}

export function buildTrackingLink({ socialPostId, platform, contentType, path = "/" }: TrackingLinkInput): string {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const url = new URL(safePath, CHECKMATCH_BASE_URL);
  url.searchParams.set("utm_source", UTM_SOURCE[platform]);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", campaignOf(contentType));
  if (socialPostId) {
    url.searchParams.set("utm_content", socialPostId);
    url.searchParams.set(POST_ATTRIBUTION_PARAM, socialPostId);
  }
  return url.toString();
}
