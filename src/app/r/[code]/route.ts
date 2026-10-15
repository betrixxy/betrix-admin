import { hashIp } from "@/lib/dashboard/ip-hash";
import { isLikelyBot, referrerHostOf, SHORT_CODE_PATTERN } from "@/lib/dashboard/short-link-code";
import { buildTrackingLink, CHECKMATCH_BASE_URL } from "@/lib/dashboard/tracking-link";
import { prisma } from "@/lib/prisma";

/**
 * Kısa link yönlendirmesi (bkz. CLAUDE.md 4.3): tıklamayı kaydeder (zaman, platform, gönderi, kaba bot
 * filtresi, IP yalnızca HMAC özeti) ve 302 ile checkmatch.net'teki hedefe UTM parametreleriyle gönderir.
 * Oturumsuz ve herkese açıktır; bilinmeyen kod checkmatch.net ana sayfasına gider.
 */

export const dynamic = "force-dynamic";

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
}

const redirect = (location: string) => new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" } });

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) return redirect(CHECKMATCH_BASE_URL);

  const link = await prisma.shortLink.findUnique({
    where: { code },
    select: { id: true, socialPostId: true, platform: true, contentType: true, targetPath: true, socialPost: { select: { platform: { select: { type: true } } } } },
  });
  if (!link) return redirect(CHECKMATCH_BASE_URL);

  const platform = link.socialPost?.platform.type ?? link.platform;
  try {
    await prisma.linkClick.create({
      data: {
        shortLinkId: link.id,
        socialPostId: link.socialPostId,
        platform,
        ipHash: hashIp(clientIp(request)),
        isBot: isLikelyBot(request.headers.get("user-agent")),
        referrerHost: referrerHostOf(request.headers.get("referer")),
      },
    });
  } catch (error) {
    // Kayıt başarısız olsa da ziyaretçi hedefe gider.
    console.warn(`[r] tıklama kaydedilemedi: ${error instanceof Error ? error.message : "bilinmeyen"}`);
  }
  if (!platform) return redirect(CHECKMATCH_BASE_URL);
  return redirect(buildTrackingLink({ socialPostId: link.socialPostId, platform, contentType: link.contentType, path: link.targetPath }));
}
