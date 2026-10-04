import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-session";
import { redirectToAnalytics, redirectToLogin } from "@/lib/dashboard/social-connect-redirect";
import { startOAuthFlow } from "@/lib/services/social/oauth-flow";
import { isProviderConfigured } from "@/lib/services/social/oauth-providers";
import { parsePlatformSlug } from "@/lib/services/social/platforms";
import { isTokenEncryptionAvailable } from "@/lib/services/social/token-crypto";

// Oturuma ve tek kullanımlık state'e bağlı — asla önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * Hesap bağlamayı başlatır: state + PKCE üretir, bunları kısa ömürlü httpOnly cookie'ye yazar
 * ve admini sağlayıcının onay ekranına yönlendirir. `proxy.ts` kapsamı dışında olduğu için
 * oturumu kendisi doğrular.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
): Promise<Response> {
  if (!(await getCurrentSession())) return redirectToLogin();

  const slug = parsePlatformSlug((await params).platform);
  if (!slug) return new Response("Bulunamadı", { status: 404 });

  if (!isProviderConfigured(slug)) return redirectToAnalytics(slug, { error: "not_configured" });
  // Token'ı saklayamayacaksak kullanıcıyı sağlayıcıya hiç göndermeyiz.
  if (!isTokenEncryptionAvailable()) return redirectToAnalytics(slug, { error: "encryption_unavailable" });

  const flow = startOAuthFlow(slug);
  const response = NextResponse.redirect(flow.authorizeUrl);
  response.cookies.set(flow.cookie.name, flow.cookie.value, flow.cookie.options);
  return response;
}
