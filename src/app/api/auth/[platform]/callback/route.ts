import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-session";
import { redirectToAnalytics, redirectToLogin } from "@/lib/dashboard/social-connect-redirect";
import { completeConnection } from "@/lib/services/social/adapter";
import { saveConnection } from "@/lib/services/social/connections";
import { expiredFlowCookie, flowCookieName, verifyOAuthState } from "@/lib/services/social/oauth-flow";
import { parsePlatformSlug } from "@/lib/services/social/platforms";
import type { ConnectErrorCode, PlatformSlug } from "@/types/social-connection";

// Tek kullanımlık yetkilendirme kodu işlenir — asla önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * Sağlayıcının dönüş adresi: state'i doğrular, kodu token'a çevirir, hesabı bulur ve token'ları
 * şifreli kaydeder. Sonuç ne olursa olsun akış cookie'si silinir (state tekrar kullanılamaz).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<Response> {
  const slug = parsePlatformSlug((await params).platform);
  if (!slug) return new Response("Bulunamadı", { status: 404 });

  const flowCookie = request.cookies.get(flowCookieName(slug))?.value;
  const outcome = await handleCallback(slug, request.nextUrl.searchParams, flowCookie);

  const response = outcome === "login" ? redirectToLogin() : redirectToAnalytics(slug, outcome);
  const expired = expiredFlowCookie(slug);
  response.cookies.set(expired.name, expired.value, expired.options);
  return response;
}

type CallbackOutcome = "login" | { connected: true } | { error: ConnectErrorCode };

async function handleCallback(
  slug: PlatformSlug,
  query: URLSearchParams,
  flowCookie: string | undefined,
): Promise<CallbackOutcome> {
  if (!(await getCurrentSession())) return "login";

  // Önce state: sahte/yeniden oynatılan bir isteğe "reddedildi" bile denmez.
  const codeVerifier = verifyOAuthState(flowCookie, query.get("state"));
  if (!codeVerifier) return { error: "invalid_state" };

  // Kullanıcı onay ekranında "iptal" dedi (OAuth 2.0 `error=access_denied` vb.).
  if (query.has("error")) return { error: "denied" };

  const code = query.get("code");
  if (!code) return { error: "invalid_state" };

  const connected = await completeConnection(slug, code, codeVerifier);
  if (!connected.ok) {
    // Yalnızca kod ve bizim ürettiğimiz mesaj loglanır — token/kod asla loglanmaz.
    console.error(`[oauth:${slug}] ${connected.error.stage} aşaması başarısız: ${connected.error.code} ${connected.error.message}`);
    return { error: connected.error.stage === "token" ? "token_exchange_failed" : "account_lookup_failed" };
  }

  const saved = await saveConnection(slug, connected.data);
  if (!saved.ok) {
    console.error(`[oauth:${slug}] token kaydedilemedi: ${saved.error}`);
    return { error: "encryption_unavailable" };
  }
  return { connected: true };
}
