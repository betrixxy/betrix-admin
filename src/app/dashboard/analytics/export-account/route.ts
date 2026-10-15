import { getCurrentSession } from "@/lib/auth/require-session";
import { ACCOUNT_CSV_HEADERS, accountCsvRow } from "@/lib/dashboard/account-export";
import { csvResponse, toCsv } from "@/lib/dashboard/csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Hesap günlük metrikleri CSV'si (tüm platformlar, tarih sırasıyla). Yalnızca oturumlu admin. */
export async function GET(): Promise<Response> {
  if (!(await getCurrentSession())) return new Response("Yetkisiz", { status: 401 });
  const rows = await prisma.accountMetricSnapshot.findMany({ orderBy: [{ date: "asc" }, { platform: "asc" }] });
  return csvResponse(`hesap-gunluk-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(ACCOUNT_CSV_HEADERS, rows.map(accountCsvRow)));
}
