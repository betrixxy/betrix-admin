import { addDays, istanbulDay, istanbulDayBounds, istanbulWeekday } from "@/lib/metrics/istanbul-time";
import type { PostCollectOutcome } from "@/types/post-metrics";

/**
 * Metrik iş kuyruğunun karar kuralları — saf fonksiyonlar (bkz. CLAUDE.md 4.4): üstel bekleme, deneme
 * sınırı, erteleme, takvim zamanları ve bağlantı uyarıları.
 */

export const MAX_ATTEMPTS = 5;
const MINUTE_MS = 60_000;
const BASE_BACKOFF_MS = 5 * MINUTE_MS;
const MAX_BACKOFF_MS = 6 * 60 * MINUTE_MS;
const DEFAULT_DEFER_MS = 60 * MINUTE_MS;
/** RUNNING'de bu kadar kalan iş (süreç öldü) yeniden kuyruğa alınır. */
export const STALE_LOCK_MS = 15 * MINUTE_MS;

/** 5 dk, 10 dk, 20 dk, 40 dk … en fazla 6 sa. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

export type JobStatus = "PENDING" | "DONE" | "FAILED" | "BLOCKED";

export interface JobUpdate {
  status: JobStatus;
  attempts: number;
  nextRunAt: Date;
  lastError: string | null;
  succeeded: boolean;
}

/**
 * Çekim sonucu → işin yeni durumu. `next`: başarıdan sonraki planlı zaman (takvim bittiyse `null` → DONE).
 */
export function applyOutcome(attempts: number, outcome: PostCollectOutcome, next: Date | null, now: Date): JobUpdate {
  switch (outcome.status) {
    case "OK":
      return next ? { status: "PENDING", attempts: 0, nextRunAt: next, lastError: null, succeeded: true } : { status: "DONE", attempts: 0, nextRunAt: now, lastError: null, succeeded: true };
    case "DEFERRED":
      return { status: "PENDING", attempts, nextRunAt: outcome.until ?? new Date(now.getTime() + DEFAULT_DEFER_MS), lastError: outcome.reason, succeeded: false };
    case "ERROR": {
      const tried = attempts + 1;
      return tried >= MAX_ATTEMPTS
        ? { status: "FAILED", attempts: tried, nextRunAt: now, lastError: outcome.message, succeeded: false }
        : { status: "PENDING", attempts: tried, nextRunAt: new Date(now.getTime() + backoffMs(tried)), lastError: outcome.message, succeeded: false };
    }
    case "BLOCKED":
      return { status: "BLOCKED", attempts, nextRunAt: now, lastError: outcome.message, succeeded: false };
    case "GONE":
      return { status: "DONE", attempts, nextRunAt: now, lastError: outcome.message, succeeded: false };
  }
}

/** X'in faturalama günü UTC'dir: günlük okuma sınırı dolunca ertesi UTC gününe (+5 dk) ertelenir. */
export function nextUtcDayStart(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5));
  return next;
}

/** Bir sonraki İstanbul `HH:MM` anı (bugünkü geçtiyse yarın). */
export function nextIstanbulTime(now: Date, hour: number, minute: number): Date {
  const today = istanbulDay(now);
  const at = (day: string) => new Date(istanbulDayBounds(day).start.getTime() + (hour * 60 + minute) * MINUTE_MS);
  const candidate = at(today);
  return candidate.getTime() > now.getTime() ? candidate : at(addDays(today, 1));
}

/** Bir sonraki Pazartesi İstanbul `HH:MM`. */
export function nextIstanbulMonday(now: Date, hour: number, minute: number): Date {
  let candidate = nextIstanbulTime(now, hour, minute);
  while (istanbulWeekday(candidate) !== 1) candidate = new Date(candidate.getTime() + 86_400_000);
  return candidate;
}

/** Günlük hesap işi: dünün (İstanbul) verisi, gün bittikten sonra 00:30'da. */
export const ACCOUNT_DAILY_AT = { hour: 0, minute: 30 } as const;
export const AUDIENCE_WEEKLY_AT = { hour: 1, minute: 0 } as const;

export function previousIstanbulDay(now: Date): string {
  return addDays(istanbulDay(now), -1);
}

export type ConnectionWarningLevel = "expired" | "expiring";

export interface ConnectionWarning {
  level: ConnectionWarningLevel;
  daysLeft: number;
}

const EXPIRY_WARNING_DAYS = 7;

/**
 * Token bitiş uyarısı: yenileme token'ı olan bağlantı (X) kendiliğinden yenilenir — uyarı yalnızca yenilenemeyen
 * token'larda (Meta ~60 gün). Bitmişse "yeniden bağlan", 7 gün kala "yakında bitiyor".
 */
export function connectionWarning(expiresAt: Date | null, hasRefreshToken: boolean, now: Date): ConnectionWarning | null {
  if (!expiresAt || hasRefreshToken) return null;
  const msLeft = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / 86_400_000);
  if (msLeft <= 0) return { level: "expired", daysLeft: 0 };
  return daysLeft <= EXPIRY_WARNING_DAYS ? { level: "expiring", daysLeft } : null;
}
