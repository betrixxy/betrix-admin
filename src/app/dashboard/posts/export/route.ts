import { getCurrentSession } from "@/lib/auth/require-session";
import { csvResponse, toCsv } from "@/lib/dashboard/csv";
import { POST_CSV_HEADERS, postCsvRow } from "@/lib/dashboard/posts-export";
import { loadPostExport } from "@/lib/dashboard/posts-export-data";
import { getPostSiteStats } from "@/lib/dashboard/site-attribution";

export const dynamic = "force-dynamic";

/** "Veriyi indir (CSV)" — gönderiler, özellikleri ve en güncel metrikleri. Yalnızca oturumlu admin. */
export async function GET(): Promise<Response> {
  if (!(await getCurrentSession())) return new Response("Yetkisiz", { status: 401 });
  const rows = await loadPostExport(await getPostSiteStats());
  return csvResponse(`gonderiler-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(POST_CSV_HEADERS, rows.map(postCsvRow)));
}
