import { env, socialUseMocks } from "@/lib/env";
import type { PlatformSlug } from "@/types/social-connection";

/**
 * Platform başına OAuth 2.0 yapılandırması. Instagram ve Facebook aynı Meta uygulamasını
 * (Facebook Login) kullanır, yalnızca istenen izinler farklıdır. Uç noktalar sağlayıcıların
 * belgelenmiş adresleridir; sürüm yükseltmesi yalnızca burada yapılır.
 */
export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: readonly string[];
  scopeSeparator: " " | ",";
  /** TikTok `client_key` bekler, diğerleri `client_id`. */
  clientIdParam: "client_id" | "client_key";
  clientId: string;
  clientSecret: string;
  /** X ve Google için PKCE (S256) kullanılır. */
  usesPkce: boolean;
  /** Token isteğinde istemci kimlik doğrulaması: form gövdesinde mi, HTTP Basic ile mi (X). */
  tokenAuth: "body" | "basic";
  /** Yetkilendirme URL'ine eklenen sağlayıcıya özel parametreler. */
  extraAuthorizeParams: Readonly<Record<string, string>>;
}

const META_GRAPH_VERSION = "v21.0";

const META_BASE = {
  authorizeUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
  tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
  scopeSeparator: ",",
  clientIdParam: "client_id",
  usesPkce: false,
  tokenAuth: "body",
  extraAuthorizeParams: {},
} as const;

function providerConfig(slug: PlatformSlug): OAuthProviderConfig {
  switch (slug) {
    case "instagram":
      return {
        ...META_BASE,
        clientId: env.META_APP_ID,
        clientSecret: env.META_APP_SECRET,
        scopes: ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"],
      };
    case "facebook":
      return {
        ...META_BASE,
        clientId: env.META_APP_ID,
        clientSecret: env.META_APP_SECRET,
        scopes: ["pages_show_list", "pages_read_engagement", "read_insights"],
      };
    case "tiktok":
      return {
        authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
        scopes: ["user.info.basic", "video.list"],
        scopeSeparator: ",",
        clientIdParam: "client_key",
        clientId: env.TIKTOK_CLIENT_KEY,
        clientSecret: env.TIKTOK_CLIENT_SECRET,
        usesPkce: false,
        tokenAuth: "body",
        extraAuthorizeParams: {},
      };
    case "youtube":
      return {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/yt-analytics.readonly",
        ],
        scopeSeparator: " ",
        clientIdParam: "client_id",
        clientId: env.YOUTUBE_CLIENT_ID,
        clientSecret: env.YOUTUBE_CLIENT_SECRET,
        usesPkce: true,
        tokenAuth: "body",
        // Yenileme token'ı yalnızca offline erişim + açık onayla verilir.
        extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
      };
    case "x":
      return {
        authorizeUrl: "https://x.com/i/oauth2/authorize",
        tokenUrl: "https://api.x.com/2/oauth2/token",
        scopes: ["tweet.read", "users.read", "offline.access"],
        scopeSeparator: " ",
        clientIdParam: "client_id",
        clientId: env.X_CLIENT_ID,
        clientSecret: env.X_CLIENT_SECRET,
        usesPkce: true,
        tokenAuth: "basic",
        extraAuthorizeParams: {},
      };
  }
}

export function getProviderConfig(slug: PlatformSlug): OAuthProviderConfig {
  return providerConfig(slug);
}

/** Mock modunda her platform "yapılandırılmış" sayılır; gerçek modda kimlik+sır gerekir. */
export function isProviderConfigured(slug: PlatformSlug): boolean {
  if (socialUseMocks) return true;
  const config = providerConfig(slug);
  return config.clientId !== "" && config.clientSecret !== "";
}

/** Sağlayıcı panellerine birebir kaydedilmesi gereken geri dönüş adresi. */
export function redirectUriFor(slug: PlatformSlug): string {
  return new URL(`/api/auth/${slug}/callback`, env.APP_BASE_URL).toString();
}
