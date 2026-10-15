import type { CsvValue } from "@/lib/dashboard/csv";
import { ACCOUNT_METRIC_FIELDS, type AccountMetricValues } from "@/types/account-metrics";

/** Hesap günlük metrikleri CSV'si — saf satır üretimi (reklam görüşmeleri için takipçi/erişim geçmişi). */

const snake = (field: string) => field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const ACCOUNT_CSV_HEADERS = ["date_ist", "platform", ...ACCOUNT_METRIC_FIELDS.map(snake), "backfilled", "captured_at_utc"] as const;

export interface AccountExportInput extends AccountMetricValues {
  date: Date;
  platform: string;
  backfilled: boolean;
  capturedAt: Date;
}

export function accountCsvRow(row: AccountExportInput): CsvValue[] {
  return [row.date.toISOString().slice(0, 10), row.platform, ...ACCOUNT_METRIC_FIELDS.map((field) => row[field]), row.backfilled, row.capturedAt];
}
