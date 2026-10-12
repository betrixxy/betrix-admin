import { socialUseMocks } from "@/lib/env";
import { z } from "zod";
import { fetchJson } from "@/lib/services/shared/http";
import { exchangeCodeLive, exchangeMetaLongLivedLive, refreshTokenLive, type SocialApiError } from "@/lib/services/social/client";
import { mapPostMetrics } from "@/lib/services/social/metrics/mappers";
import { mockAccount, mockMetricsPayload, mockTokenSet } from "@/lib/services/social/mock";
import { META_GRAPH_VERSION, getProviderConfig } from "@/lib/services/social/oauth-providers";
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
 * çağrıdır. Instagram ve X hesap bilgisi gerçektir (Yayın Merkezi paylaşımı için); Facebook/YouTube
 * hesap bilgisi ve tüm gönderi metrikleri henüz YER TUTUCUDUR (`NOT_IMPLEMENTED`) —
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

  // Meta: kısa ömürlü token uzun ömürlüye (~60 gün) çevrilir; paylaşım ve senkronizasyon bununla yapılır.
  let tokens = exchanged.data.tokens;
  if (platform === "META_INSTAGRAM" || platform === "META_FACEBOOK") {
    const longLived = await exchangeMetaLongLivedLive(tokens);
    if (!longLived.ok) return { ok: false, error: { ...longLived.error, stage: "token" } };
    tokens = longLived.data;
  }

  const account = await fetchAccountLive(platform, tokens.accessToken);
  if (!account.ok) return { ok: false, error: { ...account.error, stage: "account" } };
  return { ok: true, data: { tokens, account: account.data } };
}

const instagramAccountsSchema = z.object({
  data: z.array(z.object({ instagram_business_account: z.object({ id: z.string(), username: z.string().optional() }).optional() })),
});
const xMeSchema = z.object({ data: z.object({ id: z.string(), username: z.string() }) });

async function getJson<T extends z.ZodTypeAny>(url: string, init: RequestInit, schema: T, what: string): Promise<Result<z.infer<T>, SocialApiError>> {
  const response = await fetchJson(url, init);
  if (!response.ok) return { ok: false, error: { code: "HTTP", message: `${what}: ${response.error.message}` } };
  const parsed = schema.safeParse(response.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: { code: "INVALID_RESPONSE", message: `${what} yanıtı beklenen biçimde değil.` } };
}

/**
 * Hesap kimliği. Gerçek: Instagram (`/me/accounts` → Sayfaya bağlı Instagram iş hesabı) ve X (`/2/users/me`).
 * YER TUTUCU: Facebook (`GET /me/accounts?fields=id,name`), YouTube (`GET youtube/v3/channels?part=snippet&mine=true`).
 */
async function fetchAccountLive(platform: SocialPlatformType, accessToken: string): Promise<Result<OAuthAccount, SocialApiError>> {
  if (platform === "META_INSTAGRAM") {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`);
    url.search = new URLSearchParams({ fields: "instagram_business_account{id,username}", access_token: accessToken }).toString();
    const result = await getJson(url.toString(), {}, instagramAccountsSchema, "Instagram hesap bilgisi");
    if (!result.ok) return result;
    const account = result.data.data.map((page) => page.instagram_business_account).find((candidate) => candidate !== undefined);
    if (!account) return { ok: false, error: { code: "INVALID_RESPONSE", message: "Bu Facebook hesabına bağlı bir Instagram iş/içerik üreticisi hesabı bulunamadı." } };
    return { ok: true, data: { accountId: account.id, accountName: account.username ?? null } };
  }
  if (platform === "X") {
    const result = await getJson("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${accessToken}` } }, xMeSchema, "X hesap bilgisi");
    return result.ok ? { ok: true, data: { accountId: result.data.data.id, accountName: result.data.data.username } } : result;
  }
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
