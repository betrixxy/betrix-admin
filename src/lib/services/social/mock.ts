import { createHash, randomBytes } from "node:crypto";
import type { SocialPlatformType } from "@/types/social";
import type { OAuthAccount, OAuthTokenSet } from "@/types/social-connection";

/**
 * Mock adaptörü (bkz. CLAUDE.md 5.2 — `SOCIAL_USE_MOCKS`). Gerçek API'ye gitmeden OAuth ve
 * metrik akışını uçtan uca çalıştırır. Metrik yanıtları sağlayıcıların **ham** biçimindedir;
 * böylece mock veri de gerçek şema doğrulamasından ve `mappers.ts`'ten geçer.
 * Değerler gönderi kimliğinden deterministik türetilir ve yayından geçen süreyle büyür —
 * kademeli senkronizasyonda artış gözlemlenebilsin diye.
 */

const MOCK_TOKEN_TTL_SECONDS = 60 * 60;

export function mockTokenSet(scopes: readonly string[]): OAuthTokenSet {
  return {
    accessToken: `mock-access-${randomBytes(12).toString("base64url")}`,
    refreshToken: `mock-refresh-${randomBytes(12).toString("base64url")}`,
    expiresAt: new Date(Date.now() + MOCK_TOKEN_TTL_SECONDS * 1000),
    scopes: [...scopes],
  };
}

export function mockAccount(platform: SocialPlatformType): OAuthAccount {
  return { accountId: `mock-${platform.toLowerCase()}-account`, accountName: "CheckMatch (mock hesap)" };
}

/** Kimlikten 0..1 arası sabit bir "şans" değeri — aynı gönderi her zaman benzer performans gösterir. */
function seedOf(providerPostId: string, salt: string): number {
  const digest = createHash("sha256").update(`${providerPostId}:${salt}`).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

interface MockCounts {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchSeconds: number;
}

function mockCounts(providerPostId: string, publishedAt: Date): MockCounts {
  const hours = Math.max(0, (Date.now() - publishedAt.getTime()) / 3_600_000);
  // 72 saatte doygunluğa ulaşan büyüme eğrisi.
  const growth = 1 - Math.exp(-hours / 24);
  const potential = 2_000 + seedOf(providerPostId, "reach") * 48_000;
  const views = Math.round(potential * growth * (1.2 + seedOf(providerPostId, "views")));
  const reach = Math.round(views * (0.6 + 0.3 * seedOf(providerPostId, "unique")));
  const rate = (salt: string, max: number) => seedOf(providerPostId, salt) * max;

  return {
    views,
    reach,
    likes: Math.round(reach * rate("likes", 0.08)),
    comments: Math.round(reach * rate("comments", 0.015)),
    shares: Math.round(reach * rate("shares", 0.01)),
    saves: Math.round(reach * rate("saves", 0.02)),
    watchSeconds: Math.round(views * (4 + rate("watch", 20))),
  };
}

/** Platformun gerçek ham yanıt biçiminde mock metrik yükü. */
export function mockMetricsPayload(
  platform: SocialPlatformType,
  providerPostId: string,
  publishedAt: Date,
): unknown {
  const c = mockCounts(providerPostId, publishedAt);
  const insight = (name: string, value: number) => ({ name, values: [{ value }] });

  switch (platform) {
    case "META_INSTAGRAM":
      return {
        data: [
          insight("likes", c.likes),
          insight("comments", c.comments),
          insight("shares", c.shares),
          insight("saved", c.saves),
          insight("reach", c.reach),
          insight("views", c.views),
          insight("ig_reels_video_view_total_time", c.watchSeconds * 1000),
        ],
      };
    case "META_FACEBOOK":
      return {
        insights: {
          data: [
            insight("post_reactions_like_total", c.likes),
            insight("post_impressions_unique", c.reach),
            insight("post_impressions", c.views),
            insight("post_video_views", Math.round(c.views * 0.4)),
          ],
        },
        comments: { summary: { total_count: c.comments } },
        shares: { count: c.shares },
      };
    case "TIKTOK":
      return {
        data: {
          videos: [
            {
              id: providerPostId,
              like_count: c.likes,
              comment_count: c.comments,
              share_count: c.shares,
              view_count: c.views,
            },
          ],
        },
      };
    case "YOUTUBE":
      return {
        video: {
          items: [
            {
              id: providerPostId,
              statistics: {
                viewCount: String(c.views),
                likeCount: String(c.likes),
                commentCount: String(c.comments),
                favoriteCount: "0",
              },
            },
          ],
        },
        analytics: {
          columnHeaders: [{ name: "estimatedMinutesWatched" }, { name: "shares" }],
          rows: [[Math.round(c.watchSeconds / 60), c.shares]],
        },
      };
    case "X":
      return {
        data: {
          id: providerPostId,
          public_metrics: {
            retweet_count: c.shares,
            reply_count: c.comments,
            like_count: c.likes,
            quote_count: Math.round(c.shares * 0.2),
            bookmark_count: c.saves,
            impression_count: c.views,
          },
        },
      };
  }
}
