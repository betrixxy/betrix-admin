import type { PlayerSlot } from "@/lib/dashboard/match-day-layouts";
import { fallbackCrestSize } from "@/skills/render-engine/templates/shared/team-fallback";

/**
 * Maç Günü fotoğrafsız tarafının (yedek tasarım `emblem` kipi) YERLEŞİM KAPISI — saf. Canlı test v2 (2026-10-31):
 * Data Driven 4:5'te Göztepe arması Greenwood'un koluna değiyordu; yazı katmanının kapısı fotoğrafı görmüyordu.
 * Kural: fotoğraflı taraftaki oyuncu kesiminin ARMA SATIRLARINDAKİ opak yatay uzanımı engeldir. Arma engelle
 * `EMBLEM_GAP` kadar boşluk bırakmalı ve içerik kutusunun (`bounds`) içinde kalmalı: önce dışa doğru kaydırılır,
 * yetmezse `EMBLEM_MIN_SCALE`'e kadar küçültülür; yine olmuyorsa kart üretilmez (`EmblemPlacementError`).
 */

/** Armanın slot içindeki dikey odağı (yüzün düşeceği yer). */
export const EMBLEM_FOCUS_Y = 0.32;
/** Arma ile oyuncu kesimi arasındaki en az boşluk (px). */
export const EMBLEM_GAP = 16;
/** Arma bu ölçeğin altına küçültülmez. */
export const EMBLEM_MIN_SCALE = 0.6;
const SCALE_STEP = 0.05;

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface EmblemPlacement {
  /** Emblem görselinin tuvaldeki sol-üst köşesi ve boyutu. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Ön plan armasının tuvaldeki kutusu. */
  crest: Box;
  scale: number;
}

/** Oyuncu kesiminin verilen satır aralığındaki opak yatay uzanımı (tuval koordinatı); o satırlarda yoksa null. */
export type ObstacleSpan = (top: number, bottom: number) => { left: number; right: number } | null;

/** Slot + ölçek → emblem kutusu ve arma kutusu (yedek tasarımın kendi ölçüleriyle). */
export function emblemGeometry(slot: PlayerSlot, scale: number, centerX = slot.centerX): EmblemPlacement {
  const width = Math.max(1, Math.round(slot.maxWidth * scale));
  const height = Math.max(1, Math.round(Math.min(slot.maxHeight, slot.maxWidth * 1.35) * scale));
  const left = Math.round(centerX - width / 2);
  const top = slot.top;
  const size = fallbackCrestSize(width, height, "emblem");
  const cx = left + width / 2;
  const cy = top + height * EMBLEM_FOCUS_Y;
  return { left, top, width, height, scale, crest: { left: Math.round(cx - size / 2), right: Math.round(cx + size / 2), top: Math.round(cy - size / 2), bottom: Math.round(cy + size / 2) } };
}

/** Aralıktan (merkez için) çıkarılan bölgeler sonrası tercihe en yakın nokta; yoksa null. */
function nearestFree(min: number, max: number, cuts: readonly [number, number][], preferred: number): number | null {
  let free: [number, number][] = [[min, max]];
  for (const [a, b] of cuts) free = free.flatMap(([l, h]): [number, number][] => (b <= l || a >= h ? [[l, h]] : [...(a > l ? [[l, a] as [number, number]] : []), ...(b < h ? [[b, h] as [number, number]] : [])]));
  let best: number | null = null;
  for (const [l, h] of free) {
    if (l > h) continue;
    const point = Math.min(h, Math.max(l, preferred));
    if (best === null || Math.abs(point - preferred) < Math.abs(best - preferred)) best = point;
  }
  return best;
}

/**
 * Armanın yerini seçer; sığmazsa null (kapı reddeder). `side`: armanın tarafı — oyuncu engeline göre kayma o yöne
 * (dışa) yapılır. `blocks`: yazı katmanının ölçülmüş blokları (yerleşim kapısının kutuları) — arma onlara da değmez.
 */
export function placeEmblem(slot: PlayerSlot, side: "home" | "away", bounds: { left: number; right: number }, obstacle: ObstacleSpan | null, blocks: readonly Box[] = []): EmblemPlacement | null {
  for (let scale = 1; scale >= EMBLEM_MIN_SCALE - 1e-9; scale = Math.round((scale - SCALE_STEP) * 100) / 100) {
    const base = emblemGeometry(slot, scale);
    const half = (base.crest.right - base.crest.left) / 2 + 1; // +1: yuvarlama payı
    // Satır aralığı da boşlukla genişler: çapraz uzanan kol armanın köşesine değmesin.
    const span = obstacle?.(base.crest.top - EMBLEM_GAP, base.crest.bottom + EMBLEM_GAP) ?? null;
    // Armanın merkezinin alabileceği aralık: içerik kutusu, ve engelin dış tarafı.
    let min = bounds.left + half;
    let max = bounds.right - half;
    if (span) {
      if (side === "away") min = Math.max(min, span.right + EMBLEM_GAP + half);
      else max = Math.min(max, span.left - EMBLEM_GAP - half);
    }
    if (min > max) continue;
    const rows = { top: base.crest.top - EMBLEM_GAP, bottom: base.crest.bottom + EMBLEM_GAP };
    const cuts = blocks.filter((block) => block.top < rows.bottom && block.bottom > rows.top).map((block): [number, number] => [block.left - EMBLEM_GAP - half, block.right + EMBLEM_GAP + half]);
    const crestCenter = nearestFree(min, max, cuts, (base.crest.left + base.crest.right) / 2);
    if (crestCenter === null) continue;
    return emblemGeometry(slot, scale, Math.round(crestCenter));
  }
  return null;
}

/** Fotoğrafsız tarafın arması sığmıyor — kart üretilmez (motor `LAYOUT_OVERLAP` olarak döner). */
export class EmblemPlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmblemPlacementError";
  }
}
