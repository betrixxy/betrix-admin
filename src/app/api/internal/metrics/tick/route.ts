import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runMetricsTick } from "@/lib/metrics/tick";

/**
 * Saatlik metrik tetikleyicisi — yalnızca compose'taki `scheduler` servisi çağırır (iç ağ, `app:3000`).
 * Caddy bu yolu dışarıya 404 döndürür; ayrıca `INTERNAL_CRON_SECRET` sabit zamanlı karşılaştırılır.
 * Yalnızca OKUMA işleri çalışır (bkz. CLAUDE.md 1.10). Yanıt yalnızca sayaç içerir.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(provided: string | null): boolean {
  if (!env.INTERNAL_CRON_SECRET || !provided) return false;
  const expected = Buffer.from(env.INTERNAL_CRON_SECRET);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<Response> {
  if (!env.INTERNAL_CRON_SECRET) return Response.json({ error: "disabled" }, { status: 503 });
  if (!authorized(request.headers.get("x-cron-secret"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const report = await runMetricsTick();
    console.info(`[metrics:tick] ${JSON.stringify(report)}`);
    return Response.json({ success: true, ...report });
  } catch (error) {
    console.error(`[metrics:tick] hata: ${error instanceof Error ? error.message : "bilinmeyen"}`);
    return Response.json({ success: false }, { status: 500 });
  }
}
