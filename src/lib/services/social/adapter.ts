import { socialUseMocks } from "@/lib/env";
import { z } from "zod";
import { exchangeCodeLive, exchangeMetaLongLivedLive, getJson, refreshTokenLive, type SocialApiError } from "@/lib/services/social/client";
import { fetchMetaPermissions, findInstagramAccount, type MetaPermissions } from "@/lib/services/social/meta-accounts";
import { mockAccount, mockTokenSet } from "@/lib/services/social/mock";
import { getProviderConfig } from "@/lib/services/social/oauth-providers";
import { SLUG_TO_PLATFORM } from "@/lib/services/social/platforms";
import type { Result } from "@/types/result";
import type { SocialPlatformType } from "@/types/social";
import type { OAuthAccount, OAuthTokenSet, PlatformSlug } from "@/types/social-connection";

/**
 * Sosyal medya sağlayıcılarının tek giriş noktası. `SOCIAL_USE_MOCKS` açıkken mock adaptörüne,
 * kapalıyken gerçek API'ye yönlendirir; çağıran kod (route handler, `social-metrics.ts`) hangi
 * modda olduğunu bilmez (bkz. CLAUDE.md 1.4, 5.2).
 *
 * Gerçek mod durumu: OAuth kod değişimi ve token yenileme standart OAuth 2.0 ile gerçek
 * çağrıdır. Instagram ve X hesap bilgisi gerçektir; Facebook/YouTube hesap bilgisi YER TUTUCUDUR
 * (`NOT_IMPLEMENTED`). Gönderi metrikleri `lib/metrics/` toplayıcısındadır (Instagram + X).
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
  let metaPermissions: Result<MetaPermissions, SocialApiError> | null = null;
  if (platform === "META_INSTAGRAM" || platform === "META_FACEBOOK") {
    const longLived = await exchangeMetaLongLivedLive(tokens);
    if (!longLived.ok) return { ok: false, error: { ...longLived.error, stage: "token" } };
    tokens = longLived.data;

    // Meta token yanıtı `scope` taşımaz: istenen değil, kullanıcının gerçekten verdiği izinler kaydedilir.
    metaPermissions = await fetchMetaPermissions(tokens.accessToken);
    if (metaPermissions.ok) tokens = { ...tokens, scopes: metaPermissions.data.granted };
    else console.warn(`[oauth:${slug}] verilen izinler okunamadı, istenen izinler kaydedilecek: ${metaPermissions.error.message}`);
  }

  const account = await fetchAccountLive(platform, tokens.accessToken, metaPermissions);
  if (!account.ok) return { ok: false, error: { ...account.error, stage: "account" } };
  return { ok: true, data: { tokens, account: account.data } };
}

const xMeSchema = z.object({ data: z.object({ id: z.string(), username: z.string() }) });

/**
 * Hesap kimliği. Gerçek: Instagram (Sayfaya bağlı Instagram iş hesabı — `meta-accounts.ts`) ve X (`/2/users/me`).
 * YER TUTUCU: Facebook (`GET /me/accounts?fields=id,name`), YouTube (`GET youtube/v3/channels?part=snippet&mine=true`).
 */
async function fetchAccountLive(
  platform: SocialPlatformType,
  accessToken: string,
  metaPermissions: Result<MetaPermissions, SocialApiError> | null,
): Promise<Result<OAuthAccount, SocialApiError>> {
  if (platform === "META_INSTAGRAM") return findInstagramAccount(accessToken, metaPermissions);
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
