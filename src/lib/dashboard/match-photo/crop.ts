import sharp from "sharp";
import type { FrameBox } from "@/skills/render-engine/templates/match-result/geometry";
import type { FaceBox } from "./faces";

/**
 * Akıllı kırpma (saf geometri + sharp saliency yardımcısı). Kadraj olabildiğince geniş tutulur
 * ("tam kadraj"); konum, yüzleri şablonun yazısız bölgesine (`ResultGeometry.photoSafe`, kart
 * pikseli) yerleştirecek şekilde seçilir. Yüzler o bölgeye birlikte sığmıyorsa en büyük yüz esas
 * alınır. Yüz yoksa sharp `attention` (saliency) odağı, o da yoksa merkez. Admin önizlemede
 * `offset` (−1..1, kadraj boyunun yarısı) ve `zoom` (1..1.6) ile elle düzeltir.
 */

export interface Size {
  width: number;
  height: number;
}

export interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropOffset {
  x: number;
  y: number;
}

export type CropAnchor = "FACES" | "LARGEST_FACE" | "SALIENCY" | "CENTER";

export interface CropPlan {
  box: CropBox;
  anchor: CropAnchor;
  /** Tüm yüzler yazısız bölgede mi — değilse formda uyarı gösterilir. */
  facesInSafe: boolean;
  /** Uygulanan zoom (1 = tam kadraj) — önizleme kaydırıcısının başlangıç değeri. */
  zoom: number;
}

/** Odak kutusu (yüzler ya da en büyük yüz) yazısız bölgede mi — otomatik zoom'un durma koşulu. */
type ZoomedPlan = CropPlan & { focusInSafe: boolean };

export interface CropInput {
  source: Size;
  frame: Size;
  safe: FrameBox;
  faces: FaceBox[];
  /** Saliency odağı (kaynak pikseli); yüz varsa kullanılmaz. */
  saliency: { x: number; y: number } | null;
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
}

export const MAX_ZOOM = 1.6;
/** Yüz kutusu baş+saç payıyla büyütülür: yalnız yüz değil başın tamamı yazısız bölgede kalsın. */
const HEAD_PAD = 0.35;
/** Odak, yazısız bölgenin dikeyde bu oranına oturur (ortanın biraz üstü). */
const FOCUS_Y = 0.42;

/**
 * Belirgin yüz: alanı en büyük yüzün bu oranından az olmayan. Arkası dönük/uzaktaki oyuncular
 * (gerçek fotoğraflarda en büyüğün %25-40'ı) kadrajı yönlendirmez ve "güvenli" ölçütüne girmez.
 */
const PROMINENT_SHARE = 0.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function prominentFaces(faces: FaceBox[]): FaceBox[] {
  const largest = Math.max(0, ...faces.map((face) => face.width * face.height));
  return faces.filter((face) => face.width * face.height >= largest * PROMINENT_SHARE);
}

function union(boxes: FaceBox[]): FaceBox {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top, score: 1 };
}

const padded = (face: FaceBox): FaceBox => ({
  x: face.x - face.width * HEAD_PAD,
  y: face.y - face.height * HEAD_PAD * 1.4,
  width: face.width * (1 + 2 * HEAD_PAD),
  height: face.height * (1 + HEAD_PAD * 2.4),
  score: face.score,
});

/**
 * Kutuyu kart bölgesine yerleştiren başlangıç noktası: istenen konum, kutunun bölgede tamamen
 * kalabildiği aralığa (varsa) ve kadrajın fotoğraf içinde kaldığı aralığa sıkıştırılır.
 */
function place(boxStart: number, boxSize: number, zoneStart: number, zoneEnd: number, target: number, scale: number, slack: number): number {
  let start = boxStart + boxSize / 2 - target * scale;
  const min = boxStart + boxSize - zoneEnd * scale;
  const max = boxStart - zoneStart * scale;
  if (min <= max) start = clamp(start, min, max);
  return clamp(start, 0, slack);
}

/**
 * Kaynağı kart yüksekliğinin bu oranından fazla büyütmeyen en yüksek zoom — otomatik zoom
 * kaliteyi düşürmesin (1080px fotoğrafta 4:5 kart için ≈1.07, 4000px'te 1.6).
 */
const MIN_SOURCE_PER_FRAME = 0.75;

export function maxAutoZoom(source: Size, frame: Size): number {
  const fullHeight = Math.min(source.height, source.width / (frame.width / frame.height));
  return clamp(fullHeight / (frame.height * MIN_SOURCE_PER_FRAME), 1, MAX_ZOOM);
}

/**
 * `zoom` verilmezse (otomatik): yüzler yazısız bölgeye sığana kadar 0.05 adımla yakınlaştırılır
 * (tam kadraj öncelikli, `maxAutoZoom` sınırı). Elle verilen zoom olduğu gibi uygulanır.
 */
export function planCrop(input: CropInput): CropPlan {
  let plan = planAtZoom(input, input.zoom ?? 1);
  if (input.zoom === undefined && input.faces.length > 0) {
    const limit = maxAutoZoom(input.source, input.frame);
    for (let step = 1; !plan.focusInSafe && 1 + step * 0.05 <= limit + 1e-9; step++) plan = planAtZoom(input, 1 + step * 0.05);
  }
  return { box: plan.box, anchor: plan.anchor, facesInSafe: plan.facesInSafe, zoom: plan.zoom };
}

const insideSafe = (face: FaceBox, box: CropBox, scale: number, safe: FrameBox) => {
  const x1 = (face.x - box.left) / scale;
  const y1 = (face.y - box.top) / scale;
  return x1 >= safe.left && y1 >= safe.top && x1 + face.width / scale <= safe.right && y1 + face.height / scale <= safe.bottom;
};

const intersects = (face: FaceBox, box: CropBox) =>
  face.x < box.left + box.width && face.x + face.width > box.left && face.y < box.top + box.height && face.y + face.height > box.top;

function planAtZoom({ source, frame, safe, faces: detected, saliency, offset }: CropInput, zoom: number): ZoomedPlan {
  const faces = prominentFaces(detected);
  const aspect = frame.width / frame.height;
  const fullWidth = Math.min(source.width, source.height * aspect);
  const z = clamp(zoom, 1, MAX_ZOOM);
  const width = fullWidth / z;
  const height = width / aspect;
  const scale = width / frame.width;
  const boxWidth = Math.min(source.width, Math.floor(width));
  const boxHeight = Math.min(source.height, Math.floor(height));
  const slackX = source.width - boxWidth;
  const slackY = source.height - boxHeight;
  const safeW = safe.right - safe.left;
  const safeH = safe.bottom - safe.top;
  const targetX = safe.left + safeW / 2;
  const targetY = safe.top + safeH * FOCUS_Y;

  let anchor: CropAnchor = "CENTER";
  let left = slackX / 2;
  let top = slackY / 2;
  /** Yazısız bölgede kalması gereken yüz(ler) — ham kutu; yerleşim baş paylı kutuyla yapılır. */
  let focus: FaceBox[] = [];
  if (faces.length > 0) {
    const all = union(faces.map(padded));
    const fits = all.width <= safeW * scale && all.height <= safeH * scale;
    const largest = faces.reduce((best, face) => (face.width * face.height > best.width * best.height ? face : best));
    const target = fits ? all : padded(largest);
    focus = fits ? faces : [largest];
    anchor = fits ? "FACES" : "LARGEST_FACE";
    left = place(target.x, target.width, safe.left, safe.right, targetX, scale, slackX);
    top = place(target.y, target.height, safe.top, safe.bottom, targetY, scale, slackY);
  } else if (saliency) {
    anchor = "SALIENCY";
    left = clamp(saliency.x - targetX * scale, 0, slackX);
    top = clamp(saliency.y - targetY * scale, 0, slackY);
  }

  if (offset) {
    left = clamp(left + clamp(offset.x, -1, 1) * width * 0.5, 0, slackX);
    top = clamp(top + clamp(offset.y, -1, 1) * height * 0.5, 0, slackY);
  }

  const box = {
    left: clamp(Math.round(left), 0, slackX),
    top: clamp(Math.round(top), 0, slackY),
    width: boxWidth,
    height: boxHeight,
  };
  return {
    box,
    anchor,
    // Kadrajın tamamen dışında kalan belirgin yüz (kırpılıp atılan oyuncu) ölçüte girmez.
    facesInSafe: faces.filter((face) => intersects(face, box)).every((face) => insideSafe(face, box, scale, safe)),
    focusInSafe: focus.every((face) => insideSafe(face, box, scale, safe)),
    zoom: Math.round(z * 100) / 100,
  };
}

/** sharp `attention` odağı (kaynak pikseli) — yüz bulunamadığında en belirgin özne. */
export async function saliencyPoint(bytes: Buffer, source: Size): Promise<{ x: number; y: number } | null> {
  const probe = 512;
  const { info } = await sharp(bytes).rotate().resize(probe, probe, { fit: "cover", position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
  if (info.attentionX === undefined || info.attentionY === undefined) return null;
  const scale = Math.max(probe / source.width, probe / source.height);
  return { x: info.attentionX / scale, y: info.attentionY / scale };
}
