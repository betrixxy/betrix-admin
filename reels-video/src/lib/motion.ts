/** Saf hareket ve veri yardımcıları: sayı sayımı, nokta dağılımı, zaman çizelgesi, Türkçe ek. */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Üst üste binen geçiş süresi (kare). */
export const TRANSITION_FRAMES = 8;
/** Instagram güvenli alanı (px). */
export const SAFE = { top: 220, bottom: 420, right: 140, left: 64 } as const;
/** Başlığın ikinci satırı ~300 ms sonra gelir. */
export const LINE2_DELAY_FRAMES = 9;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Sayaç: hep artarak gelir ve son karede verideki değere tam oturur. Aşağı yuvarlandığı için ara karede
 * hedefi aşan değer okunmaz.
 */
export function countUp(frame: number, input: { to: number; start: number; duration: number }): number {
  if (frame <= input.start) return 0;
  if (frame >= input.start + input.duration) return input.to;
  return Math.floor(easeOutCubic((frame - input.start) / input.duration) * input.to);
}

export const formatInt = (value: number): string => value.toLocaleString("tr-TR");

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

/** Tekrarlanabilir karıştırma: aynı tohum her karede aynı sırayı verir (Remotion rastgelelik kabul etmez). */
export function dotOrder(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  let state = seed >>> 0 || 1;
  for (let index = count - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 1 | state) >>> 0;
    state = (state ^ (state + Math.imul(state ^ (state >>> 7), 61 | state))) >>> 0;
    const pick = state % (index + 1);
    const swap = order[index] as number;
    order[index] = order[pick] as number;
    order[pick] = swap;
  }
  return order;
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

/** "500 bin": simülasyon sayısının konuşma dili. */
export const spokenThousands = (value: number): string => (value >= 1000 && value % 1000 === 0 ? `${formatInt(value / 1000)} bin` : formatInt(value));
