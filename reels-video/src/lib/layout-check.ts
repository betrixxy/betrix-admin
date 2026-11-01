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

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export const insideSafeArea = (rect: Rect, tolerance = 1): boolean =>
  rect.x >= SAFE.left - tolerance &&
  rect.y >= SAFE.top - tolerance &&
  rect.x + rect.width <= WIDTH - SAFE.right + tolerance &&
  rect.y + rect.height <= HEIGHT - SAFE.bottom + tolerance;

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

export interface LayoutAudit {
  faceOverlaps: string[];
  outsideSafe: string[];
  textOverflow: string[];
  tooSmall: string[];
  textCollisions: string[];
  faces: number;
  blocks: number;
}

export const auditProblems = (audit: LayoutAudit): string[] => [
  ...audit.faceOverlaps.map((name) => `yüze biniyor: ${name}`),
  ...audit.outsideSafe.map((name) => `güvenli alan dışında: ${name}`),
  ...audit.textOverflow.map((name) => `metin taşıyor: ${name}`),
  ...audit.tooSmall.map((name) => `yazı küçük: ${name}`),
  ...audit.textCollisions.map((name) => `metin çakışıyor: ${name}`),
];
