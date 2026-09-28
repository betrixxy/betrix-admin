import { z } from "zod";
import { env } from "@/lib/env";
import { isRateLimited } from "@/lib/dashboard/rate-limit";
import { isOriginAllowed, trackCorsHeaders } from "@/lib/dashboard/track-cors";
import { prisma } from "@/lib/prisma";

/**
 * checkmatch.net'ten (asıl site) gelen ziyaretçi trafiğini `TrafficLog`'a yazan, dışa açık
 * uç nokta (bkz. CLAUDE.md §4.3, §1.6). Kimlik doğrulaması yoktur — bunun yerine üç katmanlı
 * korunur: (1) CORS — yalnızca `TRACK_ALLOWED_ORIGINS`'teki kaynaklardan kabul edilir ve bu
 * sunucu tarafında da zorunlu kılınır (tarayıcı dışı istekler CORS'u atlayabildiği için); (2)
 * isteğe bağlı, gizli olmayan `TRACK_SITE_KEY` — Google Analytics ölçüm ID'si gibi bir "site
 * anahtarı", `TRACK_ALLOWED_ORIGINS` dışından gelen taklit istekleri süzer; (3) IP başına
 * basit rate limit (bkz. `lib/dashboard/rate-limit.ts`).
 *
 * checkmatch.net tarafında örnek kullanım:
 *   fetch("https://<bu-panel-domaini>/api/track", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ path: location.pathname, sessionId, postId }),
 *   });
 * `sessionId`, checkmatch.net'in kendi tarafında (localStorage/cookie) ürettiği, ziyaretçiyi
 * tekilleştiren bir UUID'dir — bu uç nokta ilk gördüğü `sessionId`'yi "tekil" sayar.
 * `postId`, tıklamanın hangi `SocialPost`'tan geldiğini bilen bir bağlamdan (ör. UTM linkine
 * eklenmiş bir parametre) geliyorsa gönderilir; yoksa trafik "Doğrudan/Organik" sayılır.
 */

const RATE_LIMIT = { max: 60, windowMs: 60_000 };

const trackSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(2048)
    .refine((value) => value.startsWith("/"), "path '/' ile başlamalıdır."),
  sessionId: z.string().min(8).max(128),
  postId: z.string().min(1).max(64).optional(),
});

function jsonResponse(status: number, body: Record<string, unknown>, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function clientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: trackCorsHeaders(origin) });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return jsonResponse(403, { error: "origin_not_allowed" }, {});
  }
  const headers = trackCorsHeaders(origin);

  if (env.TRACK_SITE_KEY) {
    const providedKey = request.headers.get("x-track-key") ?? new URL(request.url).searchParams.get("key");
    if (providedKey !== env.TRACK_SITE_KEY) {
      return jsonResponse(401, { error: "invalid_site_key" }, headers);
    }
  }

  const ip = clientIp(request);
  if (isRateLimited(`track:${ip ?? "unknown"}`, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return jsonResponse(429, { error: "rate_limited" }, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" }, headers);
  }

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(400, { error: "invalid_payload", issues: parsed.error.issues.map((i) => i.message) }, headers);
  }
  const { path, sessionId, postId } = parsed.data;

  // Sahte bir postId tüm isteği reddetmez — trafik doğrudan/organik sayılarak yine kaydedilir.
  const post = postId ? await prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true } }) : null;
  const isUniqueVisit = !(await prisma.trafficLog.findFirst({ where: { sessionId }, select: { id: true } }));

  await prisma.trafficLog.create({
    data: { path, sessionId, postId: post?.id ?? null, ipAddress: ip, isUniqueVisit },
  });

  return jsonResponse(200, { ok: true }, headers);
}
