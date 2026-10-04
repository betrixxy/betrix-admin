/**
 * Kademeli (decaying) senkronizasyon takvimi — bkz. CLAUDE.md 4.1: metrikler yayından
 * 1, 6, 24 ve 72 saat sonra çekilir; sabit polling yapılmaz, API kotası korunur.
 * Saf fonksiyonlar; birim test edilebilir.
 */

export const SYNC_CHECKPOINT_HOURS = [1, 6, 24, 72] as const;

const HOUR_MS = 3_600_000;

/**
 * Geçilmiş ama henüz karşılanmamış bir kontrol noktası varsa senkronizasyon zamanı gelmiştir.
 * `lastSyncedAt` yoksa (hiç çekilmemiş) ilk kontrol noktası geçilmişse senkronize edilir.
 */
export function isSyncDue(publishedAt: Date, lastSyncedAt: Date | null, now: Date = new Date()): boolean {
  const published = publishedAt.getTime();
  const latestPassed = SYNC_CHECKPOINT_HOURS.map((hours) => published + hours * HOUR_MS)
    .filter((checkpoint) => checkpoint <= now.getTime())
    .at(-1);
  if (latestPassed === undefined) return false;
  return lastSyncedAt === null || lastSyncedAt.getTime() < latestPassed;
}
