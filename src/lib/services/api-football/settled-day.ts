import { istanbulDay } from "@/lib/metrics/istanbul-time";
import type { Fixture } from "@/types/sports";

/**
 * Geçmiş bir günün bütün maçları sonuçlandıysa (bitti / ertelendi / iptal) o günün listesi artık
 * değişmez — `fixtures.ts` onu uzun süre tutar. Canlı ya da başlamamış maçı olan gün istemcinin
 * kısa önbelleğinde (15 dk) kalır; gece yarısını geçen maç bitince gün kendiliğinden uzun önbelleğe geçer.
 */
export const SETTLED_DAY_TTL_MS = 12 * 60 * 60 * 1000;
const SETTLED_STATUS_CODES = new Set(["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]);

/** Saf: gün (İstanbul, YYYY-MM-DD) geçmişte mi ve tüm maçları sonuçlanmış mı. */
export function isSettledPastDay(date: string, fixtures: Fixture[], now: Date): boolean {
  return date < istanbulDay(now) && fixtures.every((fixture) => SETTLED_STATUS_CODES.has(fixture.progress?.statusShort ?? ""));
}
