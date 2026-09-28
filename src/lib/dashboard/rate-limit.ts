interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

/** Harita sınırsız büyümesin diye, dolmaya yaklaşınca süresi geçmiş kovalar temizlenir. */
function sweepExpired(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Basit bellek-içi sabit pencereli rate limiter. Tek Node sürecinde çalışan bu proje için
 * yeterlidir; birden fazla instance'a yatay ölçeklenirse paylaşılan bir depoya (ör. Redis)
 * taşınmalıdır — bkz. `app/api/track/route.ts`.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}
