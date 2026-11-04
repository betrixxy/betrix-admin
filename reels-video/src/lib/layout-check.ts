import { cropFor, placeCrop, type Frame } from "./crop";
import { HEIGHT, SAFE, WIDTH } from "./motion";

/**
 * Yerleşim denetimi. Yüzün üstüne hiçbir öğe binmez, içerik güvenli alanda kalır, yazı okunur boyutta olur.
 * Saf kurallar burada; render sırasında gerçek DOM kutuları bu kurallardan geçer (`AuditProbe`).
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_FONT_PX = 26;
export const MIN_CONTRAST = 4.5;

export interface SafeBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export const insideSafeArea = (rect: Rect, tolerance = 1, safe: SafeBox = SAFE): boolean =>
  rect.x >= safe.left - tolerance &&
  rect.y >= safe.top - tolerance &&
  rect.x + rect.width <= WIDTH - safe.right + tolerance &&
  rect.y + rect.height <= HEIGHT - safe.bottom + tolerance;

export interface PhotoGeometry {
  aspect: number;
  faces: Rect[];
  crops: { vertical: Rect; square: Rect };
}

/** Fotoğraftaki yüzlerin çerçeve içi konumu: `Photo.processingMeta` yüz kutusu + kırpma. */
export function facesInFrame(photo: PhotoGeometry, frame: Frame, flip = false): Rect[] {
  const place = placeCrop(cropFor(photo, frame), photo.aspect, frame);
  return photo.faces.map((face) => {
    const x = place.left + face.x * place.width;
    const width = face.width * place.width;
    return { x: flip ? frame.width - x - width : x, y: place.top + face.y * place.height, width, height: face.height * place.height };
  });
}

/** Fotoğraf tuval üzerinde `left, top` konumundaysa yüzlerin tuval konumu. */
export const facesOnCanvas = (photo: PhotoGeometry, frame: Frame, position: { left: number; top: number; flip?: boolean }): Rect[] =>
  facesInFrame(photo, frame, position.flip).map((rect) => ({ ...rect, x: rect.x + position.left, y: rect.y + position.top }));

export interface NamedRect extends Rect {
  name: string;
}

/** Yüze binen öğelerin adları. */
export const faceOverlaps = (faces: readonly Rect[], blocks: readonly NamedRect[]): string[] =>
  blocks.filter((block) => faces.some((face) => rectsOverlap(face, block))).map((block) => block.name);

export interface TextSample extends Rect {
  name: string;
  /** rgb(a) metin rengi. */
  color: string;
}

export interface LayoutAudit {
  faceOverlaps: string[];
  outsideSafe: string[];
  textOverflow: string[];
  tooSmall: string[];
  textCollisions: string[];
  /** Mono fontta harf içeren metin. */
  monoWords: string[];
  /** Şablon alt sınırının altındaki ana rakam / destek değeri. */
  sizeRule: string[];
  /** Video okunurluk kuralları: yazı boyutu, madde, not satırı, el yazısı, doluluk. Yalnız `data-video-rules` açıkken dolar. */
  videoRules?: string[];
  /** Güvenli alan içi doluluk oranı: bütün alan ve alt yarı. */
  fill?: { total: number; lower: number };
  /** Kontrast ölçümü için metin kutuları. */
  samples: TextSample[];
  faces: number;
  blocks: number;
}

export const auditProblems = (audit: Omit<LayoutAudit, "sizeRule" | "samples"> & Partial<Pick<LayoutAudit, "sizeRule">>): string[] => [
  ...audit.faceOverlaps.map((name) => `yüze biniyor: ${name}`),
  ...audit.outsideSafe.map((name) => `güvenli alan dışında: ${name}`),
  ...audit.textOverflow.map((name) => `metin taşıyor: ${name}`),
  ...audit.tooSmall.map((name) => `yazı küçük: ${name}`),
  ...audit.textCollisions.map((name) => `metin çakışıyor: ${name}`),
  ...audit.monoWords.map((name) => `mono fontta kelime: ${name}`),
  ...(audit.sizeRule ?? []).map((name) => `şablon boyutu altında: ${name}`),
  ...(audit.videoRules ?? []),
];

/** Dikdörtgenlerin birleşiminin `area` içinde kapladığı oran: `step` px'lik ızgarada. */
export function coverage(rects: readonly Rect[], area: Rect, step = 10): number {
  let covered = 0;
  let total = 0;
  for (let y = area.y + step / 2; y < area.y + area.height; y += step) {
    for (let x = area.x + step / 2; x < area.x + area.width; x += step) {
      total += 1;
      if (rects.some((rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height)) covered += 1;
    }
  }
  return total ? covered / total : 0;
}

/** WCAG göreli parlaklık. */
export function relativeLuminance(red: number, green: number, blue: number): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export const contrastRatio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export const parseRgb = (color: string): [number, number, number] | null => {
  const match = color.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/u);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

/**
 * Metin arkasındaki piksellerde en kötü durum: metin rengine en yakın %2'lik dilimin kontrastı. Tek bir parlak pikselin
 * (nokta ışık, gren) sonucu bozmaması için en uç değer değil yüzdelik alınır. `luminances` metin gizlenmiş kareden okunur.
 */
export function worstContrast(textLuminance: number, luminances: readonly number[], percentile = 0.02): number {
  if (luminances.length === 0) return Number.POSITIVE_INFINITY;
  const ratios = luminances.map((value) => contrastRatio(textLuminance, value)).sort((a, b) => a - b);
  return ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * percentile))] ?? Number.POSITIVE_INFINITY;
}
