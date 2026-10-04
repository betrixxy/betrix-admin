import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env, socialUseMocks } from "@/lib/env";
import { getProviderConfig, redirectUriFor } from "@/lib/services/social/oauth-providers";
import type { PlatformSlug } from "@/types/social-connection";

/**
 * OAuth yetkilendirme isteğinin CSRF (state) ve PKCE korumaları. `state` + `code_verifier`
 * kısa ömürlü, httpOnly, yalnızca ilgili callback yoluna gönderilen bir cookie'de tutulur;
 * callback, sorgudaki `state`'i bu cookie ile sabit zamanlı karşılaştırır.
 */

const FLOW_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export interface OAuthFlowCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}

export interface OAuthFlowStart {
  authorizeUrl: string;
  cookie: OAuthFlowCookie;
}

export function flowCookieName(slug: PlatformSlug): string {
  return `betrix_oauth_${slug}`;
}

function flowCookieOptions(slug: PlatformSlug, maxAge: number): OAuthFlowCookie["options"] {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    // Sağlayıcıdan dönüş üst düzey bir GET yönlendirmesidir — `lax` cookie'yi taşır, `strict` taşımaz.
    sameSite: "lax",
    path: `/api/auth/${slug}`,
    maxAge,
  };
}

/** Callback sonrası cookie'yi silmek için aynı ad/yol ile süresi dolmuş cookie. */
export function expiredFlowCookie(slug: PlatformSlug): OAuthFlowCookie {
  return { name: flowCookieName(slug), value: "", options: flowCookieOptions(slug, 0) };
}

const randomToken = (bytes: number) => randomBytes(bytes).toString("base64url");

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function startOAuthFlow(slug: PlatformSlug): OAuthFlowStart {
  const config = getProviderConfig(slug);
  const state = randomToken(32);
  const verifier = randomToken(48);
  const redirectUri = redirectUriFor(slug);

  const cookie: OAuthFlowCookie = {
    name: flowCookieName(slug),
    value: `${state}.${verifier}`,
    options: flowCookieOptions(slug, FLOW_COOKIE_MAX_AGE_SECONDS),
  };

  if (socialUseMocks) {
    // Mock modu: sağlayıcıya gidilmez, kullanıcı onaylamış gibi doğrudan callback'e dönülür —
    // state/cookie doğrulaması gerçek akıştakiyle aynı şekilde çalışır.
    const callback = new URL(redirectUri);
    callback.searchParams.set("code", `mock-code-${randomToken(8)}`);
    callback.searchParams.set("state", state);
    return { authorizeUrl: callback.toString(), cookie };
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set(config.clientIdParam, config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(config.scopeSeparator));
  url.searchParams.set("state", state);
  if (config.usesPkce) {
    url.searchParams.set("code_challenge", pkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  for (const [key, value] of Object.entries(config.extraAuthorizeParams)) {
    url.searchParams.set(key, value);
  }

  return { authorizeUrl: url.toString(), cookie };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Sorgudaki `state` cookie'dekiyle eşleşiyorsa PKCE `code_verifier`'ı döner, aksi halde `null`.
 * Eksik/bozuk cookie, süresi dolmuş akış veya sahte istek aynı şekilde reddedilir.
 */
export function verifyOAuthState(cookieValue: string | undefined, state: string | null): string | null {
  if (!cookieValue || !state) return null;
  const [expectedState, verifier] = cookieValue.split(".");
  if (!expectedState || !verifier) return null;
  return safeEqual(expectedState, state) ? verifier : null;
}
