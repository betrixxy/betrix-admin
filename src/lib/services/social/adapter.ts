import { socialUseMocks } from "@/lib/env";
import { exchangeCodeLive, refreshTokenLive, type SocialApiError } from "@/lib/services/social/client";
import { mapPostMetrics } from "@/lib/services/social/metrics/mappers";
import { mockAccount, mockMetricsPayload, mockTokenSet } from "@/lib/services/social/mock";
import { getProviderConfig } from "@/lib/services/social/oauth-providers";
import { SLUG_TO_PLATFORM } from "@/lib/services/social/platforms";
import type { Result } from "@/types/result";
import type { SocialPlatformType } from "@/types/social";
import type { OAuthAccount, OAuthTokenSet, PlatformSlug, PostMetricsSnapshot } from "@/types/social-connection";

/**
 * Sosyal medya sağlayıcılarının tek giriş noktası. `SOCIAL_USE_MOCKS` açıkken mock adaptörüne,
 * kapalıyken gerçek API'ye yönlendirir; çağıran kod (route handler, `social-metrics.ts`) hangi
 * modda olduğunu bilmez (bkz. CLAUDE.md 1.4, 5.2).
 *
 * Gerçek mod durumu: OAuth kod değişimi ve token yenileme standart OAuth 2.0 ile gerçek
 * çağrıdır. Hesap bilgisi ve gönderi metrikleri henüz YER TUTUCUDUR (`NOT_IMPLEMENTED`) —
 * her platform için çağrılacak uç nokta aşağıda not edildi; yanıtlar `metrics/raw-types.ts`
 * şemalarına uyduğu sürece `mappers.ts` değişmeden çalışır.
 */

const notImplemented = (what: string): { ok: false; error: SocialApiError } => ({
  ok: false,
  error: { code: "NOT_IMPLEMENTED", message: `${what} gerçek API çağrısı henüz bağlanmadı.` },
});

export interface ConnectResult {
  tokens: OAuthTokenSet;
  account: OAuthAccount;
}

export async function completeConnection(
  slug: PlatformSlug,
  code: string,
  codeVerifier: string,
): Promise<Result<ConnectResult, SocialApiError & { stage: "token" | "account" }>> {
  const platform = SLUG_TO_PLATFORM[slug];

  if (socialUseMocks) {
    return {
      ok: true,
      data: { tokens: mockTokenSet(getProviderConfig(slug).scopes), account: mockAccount(platform) },
    };
  }

  const exchanged = await exchangeCodeLive(slug, code, codeVerifier);
  if (!exchanged.ok) return { ok: false, error: { ...exchanged.error, stage: "token" } };

  // TikTok hesap kimliğini token yanıtında (`open_id`) verir; diğerleri ayrı bir çağrı ister.
  if (platform === "TIKTOK" && exchanged.data.raw.open_id) {
    return {
      ok: true,
      data: { tokens: exchanged.data.tokens, account: { accountId: exchanged.data.raw.open_id, accountName: null } },
    };
  }

  const account = await fetchAccountLive(platform);
  if (!account.ok) return { ok: false, error: { ...account.error, stage: "account" } };
  return { ok: true, data: { tokens: exchanged.data.tokens, account: account.data } };
}

/**
 * YER TUTUCU — hesap kimliği:
 * - Instagram: `GET /me/accounts?fields=instagram_business_account{id,username}`
 * - Facebook:  `GET /me/accounts?fields=id,name` (Sayfa kimliği + sayfa token'ı)
 * - YouTube:   `GET youtube/v3/channels?part=snippet&mine=true`
 * - X:         `GET /2/users/me`
 */
async function fetchAccountLive(platform: SocialPlatformType): Promise<Result<OAuthAccount, SocialApiError>> {
  return notImplemented(`${platform} hesap bilgisi`);
}

export async function refreshAccessToken(
  slug: PlatformSlug,
  refreshToken: string,
): Promise<Result<OAuthTokenSet, SocialApiError>> {
  if (socialUseMocks) return { ok: true, data: mockTokenSet(getProviderConfig(slug).scopes) };
  return refreshTokenLive(slug, refreshToken);
}

export interface MetricsRequest {
  platform: SocialPlatformType;
  accessToken: string;
  accountId: string;
  providerPostId: string;
  publishedAt: Date;
}

/** Tek gönderinin metrikleri: ham yanıt → şema doğrulaması → kanonik `PostMetricsSnapshot`. */
export async function fetchPostMetrics(request: MetricsRequest): Promise<Result<PostMetricsSnapshot, SocialApiError>> {
  const payload = socialUseMocks
    ? { ok: true as const, data: mockMetricsPayload(request.platform, request.providerPostId, request.publishedAt) }
    : await fetchMetricsPayloadLive(request);
  if (!payload.ok) return payload;

  const mapped = mapPostMetrics(request.platform, request.providerPostId, payload.data);
  return mapped.ok ? mapped : { ok: false, error: { code: "INVALID_RESPONSE", message: mapped.error } };
}

/**
 * YER TUTUCU — gönderi metrikleri (bkz. `metrics/raw-types.ts` beklenen biçimler):
 * - Instagram: `GET /{media-id}/insights?metric=likes,comments,shares,saved,reach,views,ig_reels_video_view_total_time`
 * - Facebook:  `GET /{post-id}/insights?metric=post_impressions,post_impressions_unique,post_video_views,post_reactions_like_total`
 *              + `GET /{post-id}?fields=comments.summary(true),shares`
 * - TikTok:    `POST /v2/video/query/?fields=id,like_count,comment_count,share_count,view_count` (`filters.video_ids`)
 * - YouTube:   `GET youtube/v3/videos?part=statistics&id=…` + `youtubeAnalytics/v2/reports?metrics=estimatedMinutesWatched,shares&filters=video==…`
 * - X:         `GET /2/tweets/{id}?tweet.fields=public_metrics,non_public_metrics`
 * Rate-limit/retry `shared/http.ts::fetchJson` ile, token `Authorization: Bearer` başlığında.
 */
async function fetchMetricsPayloadLive(request: MetricsRequest): Promise<Result<unknown, SocialApiError>> {
  return notImplemented(`${request.platform} gönderi metrikleri`);
}
