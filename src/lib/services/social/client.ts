import { z } from "zod";
import { fetchJson } from "@/lib/services/shared/http";
import { getProviderConfig, redirectUriFor, type OAuthProviderConfig } from "@/lib/services/social/oauth-providers";
import type { Result } from "@/types/result";
import type { OAuthTokenSet, PlatformSlug } from "@/types/social-connection";

/**
 * Gerçek sağlayıcılara giden OAuth 2.0 token istekleri (kod değişimi + yenileme) — timeout/retry
 * `shared/http.ts`'tedir. Mock modunda bu dosya hiç çağrılmaz (bkz. `adapter.ts`).
 */

export interface SocialApiError {
  code: "HTTP" | "INVALID_RESPONSE" | "NOT_IMPLEMENTED";
  message: string;
}

/** Standart OAuth 2.0 token yanıtı; TikTok `open_id`'yi, Meta `expires_in`'i opsiyonel verir. */
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.coerce.number().int().positive().optional(),
  scope: z.string().optional(),
  open_id: z.string().optional(),
});

export type TokenResponseRaw = z.infer<typeof tokenResponseSchema>;

function toTokenSet(raw: TokenResponseRaw, config: OAuthProviderConfig, previousRefresh: string | null): OAuthTokenSet {
  return {
    accessToken: raw.access_token,
    // Bazı sağlayıcılar (Google) yenilemede yeni refresh token vermez — eskisi geçerli kalır.
    refreshToken: raw.refresh_token ?? previousRefresh,
    expiresAt: raw.expires_in ? new Date(Date.now() + raw.expires_in * 1000) : null,
    scopes: raw.scope ? raw.scope.split(/[\s,]+/).filter(Boolean) : [...config.scopes],
  };
}

async function postTokenRequest(
  config: OAuthProviderConfig,
  params: Record<string, string>,
): Promise<Result<TokenResponseRaw, SocialApiError>> {
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (config.tokenAuth === "basic") {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  } else {
    body.set(config.clientIdParam, config.clientId);
    body.set("client_secret", config.clientSecret);
  }

  // Token istekleri tekrarlanmaz: yetkilendirme kodu tek kullanımlıktır.
  const response = await fetchJson(config.tokenUrl, { method: "POST", headers, body }, { retries: 0 });
  if (!response.ok) return { ok: false, error: { code: "HTTP", message: response.error.message } };

  const parsed = tokenResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: "Token yanıtı beklenen biçimde değil." } };
  }
  return { ok: true, data: parsed.data };
}

export async function exchangeCodeLive(
  slug: PlatformSlug,
  code: string,
  codeVerifier: string,
): Promise<Result<{ tokens: OAuthTokenSet; raw: TokenResponseRaw }, SocialApiError>> {
  const config = getProviderConfig(slug);
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUriFor(slug),
  };
  if (config.usesPkce) params.code_verifier = codeVerifier;

  const result = await postTokenRequest(config, params);
  if (!result.ok) return result;
  return { ok: true, data: { tokens: toTokenSet(result.data, config, null), raw: result.data } };
}

export async function refreshTokenLive(
  slug: PlatformSlug,
  refreshToken: string,
): Promise<Result<OAuthTokenSet, SocialApiError>> {
  const config = getProviderConfig(slug);
  const result = await postTokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken });
  if (!result.ok) return result;
  return { ok: true, data: toTokenSet(result.data, config, refreshToken) };
}
