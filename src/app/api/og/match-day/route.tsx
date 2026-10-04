import { ImageResponse } from "next/og";
import { getCurrentSession } from "@/lib/auth/require-session";
import { loadMatchDayFonts, resolveMatchDayCard } from "@/lib/dashboard/match-day-assets";
import { parseMatchDayParams } from "@/lib/dashboard/match-day-params";
import { MATCH_DAY_FEED_SIZE, MatchDayFeedCard } from "@/skills/render-engine/templates/match-day-feed";

// Görseller her istekte parametrelerden çizilir ve oturuma bağlıdır (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * DEVRE DIŞI: Saf HTML/CSS (Satori) kartı yerini Fal.ai ile harmanlanan üreticiye bıraktı —
 * bkz. `/dashboard/studio/match-day` ve `lib/dashboard/match-day-engine.ts`. Şablonun kendisi
 * orada tipografi katmanı (`variant="overlay"`) olarak kullanılmaya devam ediyor. Hızlı bir
 * yazı/yerleşim önizlemesi için yeniden açmak gerekirse bu bayrağı `true` yapmak yeterli.
 */
const MATCH_DAY_OG_ROUTE_ENABLED = false;

/** Sosyal medya "Maç Günü" kartı (1080×1350 PNG) — yalnızca giriş yapmış admine açık. */
export async function GET(request: Request): Promise<Response> {
  if (!MATCH_DAY_OG_ROUTE_ENABLED) {
    return new Response("Bu uç nokta devre dışı — /dashboard/studio/match-day kullanın.", { status: 410 });
  }
  if (!(await getCurrentSession())) return new Response("Yetkisiz", { status: 401 });

  const params = parseMatchDayParams(new URL(request.url).searchParams);
  if (!params.ok) return Response.json({ error: params.error }, { status: 400 });

  const [card, fonts] = await Promise.all([resolveMatchDayCard(params.data), loadMatchDayFonts()]);

  return new ImageResponse(<MatchDayFeedCard card={card} />, {
    ...MATCH_DAY_FEED_SIZE,
    fonts,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
