import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import type { ContentPhase } from "@/types/content-type";

/**
 * Maç Merkezi ve stüdyoların fikstür penceresi — saf fonksiyonlar, tek kaynak. Günler İstanbul
 * takvimine göredir (sunucu UTC'de çalışsa da). Bir maç başlama saatinin İstanbul gününe aittir:
 * dün 22:00'de başlayıp gece yarısından sonra (uzatma/penaltılar) biten maç "dün"de kalır.
 */

/** Geriye bakış: biten maçların maç sonu içerikleri için. Hafta sonu için 2'ye çıkarılabilir. */
export const MATCH_CENTER_PAST_DAYS = 1;
/** İleriye bakış (bugün dahil) — maç öncesi formların eski 7 günlük penceresi. */
export const SELECTABLE_FIXTURE_DAYS = 7;

export interface DayRange {
  /** YYYY-MM-DD (İstanbul), dahil */
  from: string;
  /** YYYY-MM-DD (İstanbul), dahil */
  to: string;
}

/** Bugün … bugün + 6 — maç öncesi stüdyoların ve formların penceresi. */
export function upcomingRange(now: Date): DayRange {
  const today = istanbulDay(now);
  return { from: today, to: addDays(today, SELECTABLE_FIXTURE_DAYS - 1) };
}

/** Dün 00:00 (İstanbul) … bugün + 6 — Maç Merkezi listesi. */
export function matchCenterRange(now: Date, pastDays = MATCH_CENTER_PAST_DAYS): DayRange {
  const upcoming = upcomingRange(now);
  return { from: addDays(upcoming.from, -pastDays), to: upcoming.to };
}

/** Maç sonrası türler geçmiş pencereyi de kabul eder; maç öncesi türlerde eski kural (bugünden itibaren). */
export function studioRange(phase: ContentPhase, now: Date): DayRange {
  return phase === "post_match" ? matchCenterRange(now) : upcomingRange(now);
}

export function isInRange(kickoffUtc: string, range: DayRange): boolean {
  const day = istanbulDay(new Date(kickoffUtc));
  return day >= range.from && day <= range.to;
}

export function isFixtureInStudioWindow(kickoffUtc: string, phase: ContentPhase, now: Date): boolean {
  return isInRange(kickoffUtc, studioRange(phase, now));
}

/** Bir maçın İstanbul günü bugünden önce mi — Maç Merkezi'nde "Dün" bölümü için. */
export function isPastDay(day: string, now: Date): boolean {
  return day < istanbulDay(now);
}
