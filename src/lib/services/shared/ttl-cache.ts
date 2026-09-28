interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Süreç içi, TTL'li basit önbellek — sağlayıcı kotasını korumak ve CLAUDE.md 2.3'teki tazelik
 * sürelerini uygulamak için. Tek instance (Mac Mini) dağıtımı için yeterlidir; yatay
 * ölçeklenirse paylaşılan bir depoya (Redis vb.) taşınmalıdır (bkz. rate-limit.ts ile aynı not).
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
