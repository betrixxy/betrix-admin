/** Saf hareket ve veri yardımcıları: sayı sayımı, nokta dağılımı, zaman çizelgesi, biçimler. */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Üst üste binen geçiş süresi (kare). */
export const TRANSITION_FRAMES = 8;
/** Instagram güvenli alanı (px). */
export const SAFE = { top: 220, bottom: 420, right: 140, left: 64 } as const;
export const CONTENT_WIDTH = WIDTH - SAFE.left - SAFE.right;
/** Başlığın ikinci satırı ~300 ms sonra gelir. */
export const LINE2_DELAY_FRAMES = 9;

/**
 * Üç bölge (güvenli alan içinde): başlık, ana görsel, veri şeridi. Ana görsel güvenli yüksekliğin ~%59'u: 1920'nin
 * %55'i (1056 px) güvenli alana sığmaz. Fotoğraf bölgelerin altından geçer.
 */
export const ZONES = {
  /** CLAUDE.md 3.3: logo ve kritik veri üst 250 px'e girmez. */
  hudTop: 252,
  /** Büyük harf İ noktası logoya değmesin. */
  titleTop: 312,
  mainTop: 510,
  mainHeight: 790,
  stripTop: 1310,
  stripHeight: 165,
  progressTop: 1490,
} as const;

/** Tipografi ölçeği (px). */
export const TYPE = { title: 92, hero: 200, big: 120, value: 56, team: 40, label: 34, note: 26 } as const;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Sayaç: hep artar, hedefi aşmaz, son karede verideki değere tam oturur. */
export function countUp(frame: number, input: { to: number; start: number; duration: number }): number {
  if (frame <= input.start) return 0;
  if (frame >= input.start + input.duration) return input.to;
  return Math.floor(easeOutCubic((frame - input.start) / input.duration) * input.to);
}

/** Ondalıklı sayaç: `countUp` ile aynı kural, adım 0,1. */
export const countUpTenths = (frame: number, input: { to: number; start: number; duration: number }): number =>
  countUp(frame, { ...input, to: Math.round(input.to * 10) }) / 10;

export const formatInt = (value: number): string => value.toLocaleString("tr-TR");
/** "1,8" */
export const formatDecimal = (value: number, digits = 1): string => value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Yüzdeleri toplamı tam `total` olan nokta sayılarına böler (en büyük kalan yöntemi). */
export function splitDots(shares: readonly number[], total: number): number[] {
  const sum = shares.reduce((acc, share) => acc + share, 0);
  const raw = shares.map((share) => (sum > 0 ? (share / sum) * total : 0));
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

/** Tekrarlanabilir sayı üreteci: Remotion rastgelelik kabul etmez. */
export function seeded(seed: number): number {
  let state = (seed + 0x6d2b79f5) >>> 0;
  state = Math.imul(state ^ (state >>> 15), 1 | state);
  state = (state + Math.imul(state ^ (state >>> 7), 61 | state)) ^ state;
  return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
}

export interface TimelineEntry {
  from: number;
  duration: number;
}

/** Sahneler üst üste biner: her sahne bir öncekinin bitişinden `overlap` kare önce başlar. */
export function buildTimeline(durations: readonly number[], overlap: number = TRANSITION_FRAMES): { entries: TimelineEntry[]; total: number } {
  const entries: TimelineEntry[] = [];
  let cursor = 0;
  durations.forEach((duration, index) => {
    const from = index === 0 ? 0 : cursor - overlap;
    entries.push({ from, duration });
    cursor = from + duration;
  });
  return { entries, total: cursor };
}

const TEN_SUFFIX: Record<number, string> = { 0: "0'ı", 1: "1'i", 2: "2'si", 3: "3'ü", 4: "4'ü", 5: "5'i", 6: "6'sı", 7: "7'si", 8: "8'i", 9: "9'u", 10: "10'u" };

/** "4'ü": 10 üzerinden sayının iyelik eki. */
export const ofTen = (value: number): string => TEN_SUFFIX[value] ?? String(value);

const LOCATIVE: Record<number, string> = { 0: "ında", 1: "inde", 2: "sinde", 3: "ünde", 4: "ünde", 5: "inde", 6: "sında", 7: "sinde", 8: "inde", 9: "unda" };
const TENS_LOCATIVE: Record<number, string> = { 10: "unda", 20: "sinde", 30: "unda", 40: "ında", 50: "sinde", 60: "ında", 70: "inde", 80: "inde", 90: "ında" };

/** "36'sında", "70'inde", "100'ünde": sayının bulunma eki. */
export function withLocative(value: number): string {
  if (value === 100) return "100'ünde";
  const suffix = value % 10 === 0 ? TENS_LOCATIVE[value] : LOCATIVE[value % 10];
  return `${value}'${suffix ?? "inde"}`;
}

/** "500 bin" */
export const spokenThousands = (value: number): string => (value >= 1000 && value % 1000 === 0 ? `${formatInt(value / 1000)} bin` : formatInt(value));
