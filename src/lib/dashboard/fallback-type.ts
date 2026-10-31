import type { FrameBox } from "@/skills/render-engine/templates/match-result/geometry";

/**
 * Yedek tasarımın DEV SOLUK ADI (zemin tipografisi, `templates/shared/team-fallback.tsx`) — yerleşim planı.
 * Canlı test v2 (2026-10-31): ad tahmini genişlikle büyütülüyordu; Kahraman Liste'de kenardan kesildi
 * ("GÖZTEPE S", yazım hatası gibi okunur), Vitrin'in çapraz hattında iki takımın adı üst üste bindi.
 *
 * Kural: ad GERÇEK ölçüyle (Anton, Satori çizimi — `team-fallback-art.ts::measureDisplayEm`) izinli kutuya
 * sığdırılır. Tercih punto panel yüksekliğinin `TYPE_HEIGHT_RATIO`'su (genişliğin `TYPE_WIDTH_RATIO`'sunu geçmez); sığmazsa küçülür, ama tercihin
 * `TYPE_MIN_SCALE`'inin altına inecekse sıradaki aday (kısa ad) denenir; o da sığmazsa ad HİÇ yazılmaz.
 * İzinli kutu: panel (kenarlardan `TYPE_MARGIN_RATIO` içeride); çapraz bölünmüş posterde ayrıca çizginin
 * kendi tarafı (`posterTypeBounds`) — iki ad kutusu kesişemez.
 */

/** Tercih edilen punto: panel yüksekliğinin oranı … */
export const TYPE_HEIGHT_RATIO = 0.3;
/** … ama dar ve uzun panelde (Kahraman Liste kapağı 640×1350) genişliğin bu oranını geçmez. */
export const TYPE_WIDTH_RATIO = 0.4;
/** Bunun altına küçülecekse ad "sığmıyor" sayılır (sıradaki aday / hiç). */
export const TYPE_MIN_SCALE = 0.5;
/** Adın üst kenarı: panel yüksekliğinin oranı (ad panelin alt bandında durur). */
export const TYPE_TOP_RATIO = 0.7;
/** Yatay kenar payı: panel genişliğinin oranı (kesim görünmesin). */
export const TYPE_MARGIN_RATIO = 0.03;
/** Harf aralığı (punto oranı) — ölçüm de aynı değerle yapılır. */
export const TYPE_LETTER_SPACING = 0.01;
/** Çapraz çizgiye en az uzaklık (px, panel genişliğinin oranı ile en büyüğü). */
const DIAGONAL_GAP = 24;

/** Panele göre yatay izinli aralık (piksel, panel koordinatı). */
export interface TypeBounds {
  left: number;
  right: number;
}

export interface FallbackTypePlan {
  text: string;
  size: number;
  /** Panele göre kutu (mürekkep genişliği; satır yüksekliği = punto). */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Metnin 1 px puntodaki genişliği (harf aralığı dahil). */
export type MeasureEm = (text: string) => number;

/** Adayları sırayla dener (uzun ad → kısa ad); ilk sığanı döner, hiçbiri sığmazsa null. */
export function planFallbackType(candidates: readonly string[], panel: { width: number; height: number }, measure: MeasureEm, bounds?: TypeBounds): FallbackTypePlan | null {
  const margin = Math.round(panel.width * TYPE_MARGIN_RATIO);
  const left = Math.max(margin, Math.round(bounds?.left ?? 0));
  const right = Math.min(panel.width - margin, Math.round(bounds?.right ?? panel.width));
  const available = right - left;
  const preferred = Math.round(Math.min(panel.height * TYPE_HEIGHT_RATIO, panel.width * TYPE_WIDTH_RATIO));
  const top = Math.round(panel.height * TYPE_TOP_RATIO);
  if (available <= 0 || preferred <= 0) return null;
  const seen = new Set<string>();
  for (const raw of candidates) {
    const text = raw.trim();
    if (text === "" || seen.has(text)) continue;
    seen.add(text);
    const em = measure(text);
    if (!(em > 0)) continue;
    const size = Math.floor(Math.min(preferred, available / em, panel.height - top));
    if (size < preferred * TYPE_MIN_SCALE) continue;
    const width = Math.ceil(em * size);
    return { text, size, left: Math.round(left + (available - width) / 2), top, width, height: size };
  }
  return null;
}

/** Çizginin x'i (tuval koordinatı): `topX` bölgenin üstünde, `bottomX` altında. */
const diagonalX = (photo: DiagonalSplit, y: number) => photo.topX + ((photo.bottomX - photo.topX) * (y - photo.region.top)) / Math.max(1, photo.region.bottom - photo.region.top);

export interface DiagonalSplit {
  region: FrameBox;
  topX: number;
  bottomX: number;
  panels: { home: FrameBox; away: FrameBox };
}

/**
 * Çapraz bölünmüş posterde (Vitrin 01, Oyuncu Karşılaştırması 01) adın izinli aralığı: ad bandı boyunca
 * çizginin KENDİ tarafı, çizgiden `DIAGONAL_GAP` uzakta. Ev sahibi çizginin solunda, deplasman sağında kalır.
 */
export function posterTypeBounds(photo: DiagonalSplit, side: "home" | "away"): TypeBounds {
  const panel = photo.panels[side];
  const height = panel.bottom - panel.top;
  const bandTop = panel.top + height * TYPE_TOP_RATIO;
  const bandBottom = panel.bottom;
  const xs = [diagonalX(photo, bandTop), diagonalX(photo, bandBottom)];
  const gap = Math.max(DIAGONAL_GAP, Math.round((photo.region.right - photo.region.left) * 0.02));
  if (side === "home") return { left: 0, right: Math.min(...xs) - gap - panel.left };
  return { left: Math.max(...xs) + gap - panel.left, right: panel.right - panel.left };
}
