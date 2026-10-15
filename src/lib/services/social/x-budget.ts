/**
 * X okuma kredisi hesapları — saf fonksiyonlar (bkz. CLAUDE.md 4.5). Ücret dönen kaynak başınadır;
 * günlük sınır (`X_DAILY_READ_LIMIT`) okunan gönderi sayısıdır ve X'in faturalama günü gibi UTC'dir.
 */

export const X_PRICE_USD = {
  ownedPostRead: 0.001,
  postRead: 0.005,
  userRead: 0.01,
} as const;

/** UTC günü — `YYYY-MM-DD`. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Bugün daha kaç gönderi okunabilir; istenen sayıyı aşmaz, negatife düşmez. */
export function xReadAllowance(usedToday: number, dailyLimit: number, wanted: number): number {
  return Math.max(0, Math.min(wanted, dailyLimit - usedToday));
}

export interface ImportEstimate {
  requests: number;
  /** Okunacak en fazla gönderi. */
  reads: number;
  /** Owned read ($0.001) — uygulama sahibi = hesap. */
  ownedUsd: number;
  /** Standart okuma ($0.005) — owned sayılmazsa üst sınır. */
  standardUsd: number;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** "Geçmiş gönderileri içe aktar" düğmesinde gösterilen tahmin. Instagram'da ücret yoktur. */
export function estimateImport(platform: "META_INSTAGRAM" | "X", count: number): ImportEstimate {
  const reads = Math.max(0, Math.floor(count));
  if (platform === "META_INSTAGRAM") return { requests: Math.ceil(reads / 50), reads, ownedUsd: 0, standardUsd: 0 };
  return { requests: Math.ceil(reads / 100), reads, ownedUsd: round(reads * X_PRICE_USD.ownedPostRead), standardUsd: round(reads * X_PRICE_USD.postRead) };
}
