import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import { matchResultGeometry, type FrameBox, type ResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import type { MatchResultTemplateId } from "@/types/match-result";
import type { Result } from "@/types/result";
import { planCrop, saliencyPoint, type CropBox, type CropOffset, type CropPlan } from "./crop";
import { detectFaces, type FaceBox } from "./faces";
import { cropAndGrade } from "./grade";
import { shadeStrengthFor, textRegionLuminance } from "./legibility";
import { checkPhotoQuality, type PhotoQuality, type PhotoUpscaler } from "./quality";

/**
 * Tam kadraj maç fotoğrafı hattı (Maç Sonucu): kalite kapısı (gerekirse tek Fal upscale) → yüz
 * tespiti (yerel) → akıllı kırpma → renk tonlama → yazı bölgesi parlaklığı → gradyan gücü.
 * Çıktı kart boyutunda sanat katmanıdır; üstüne şablon (Satori) ve set bitişi (gren + vinyet) basılır.
 */

export interface MatchPhotoInput {
  image: UploadedImage;
  frame: MatchDayFrame;
  /** Set vurgu rengi (`resultAccentHex`) ve varsa turnuvanın derin tonu. */
  accentHex: string;
  deepHex?: string | undefined;
  /** Şablon: C · Manşet'te yazısız bölge başlık bandının altından başlar. */
  template?: MatchResultTemplateId | undefined;
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
  upscale?: PhotoUpscaler | undefined;
  /** Başka kartın geometrisi (Oyuncu İstatistikleri A); verilmezse Maç Sonucu şablonununki. */
  geometry?: ((side: ColumnSide) => ResultGeometry) | undefined;
  /** 16:9 denenecek sütun tarafları (carousel: 01 ile aynı taraf); verilmezse sağ, uymazsa sol. */
  sides?: ColumnSide[] | undefined;
}

export interface PreparedMatchPhoto {
  /** Kart boyutunda, tonlanmış sanat katmanı (PNG). */
  art: Buffer;
  shadeStrength: number;
  luminance: number;
  crop: CropPlan;
  /** 16:9 set sütununun tarafı: özne sağdaysa "left" (aynalanmış); dikeyde her zaman "right". */
  side: ColumnSide;
  faces: FaceBox[];
  quality: PhotoQuality;
}

const point = (box: CropBox, frame: { width: number }, at: { x: number; y: number }) => {
  const scale = box.width / frame.width;
  return { x: (at.x - box.left) / scale, y: (at.y - box.top) / scale };
};
const inside = (p: { x: number; y: number }, safe: FrameBox) => p.x >= safe.left && p.x <= safe.right && p.y >= safe.top && p.y <= safe.bottom;

/**
 * 16:9 aynalama: kırpma önce sağ sütunla planlanır; yüzler (yüz yoksa saliency odağı) yazısız
 * bölgede kalmıyorsa sol sütun denenir ve oradaki plan uygunsa o seçilir. İkisi de uygun
 * değilse varsayılan sağ sütun (formda "güvenli değil" uyarısı).
 */
function chooseSide<T extends { side: ColumnSide; crop: CropPlan; safe: FrameBox }>(plans: T[], frame: MatchDayFrame, saliency: { x: number; y: number } | null, hasFaces: boolean): T | undefined {
  const fits = (plan: T) => (hasFaces ? plan.crop.facesInSafe : !saliency || inside(point(plan.crop.box, frame, saliency), plan.safe));
  return plans.find(fits) ?? plans[0];
}

/** EXIF yönü varsa bir kez uygulanır: yüz koordinatları, kırpma ve boyutlar aynı eksende kalır. */
async function upright(image: UploadedImage): Promise<UploadedImage> {
  const { orientation } = await sharp(image.bytes).metadata();
  if (!orientation || orientation === 1) return image;
  const { data, info } = await sharp(image.bytes).rotate().jpeg({ quality: 95 }).toBuffer({ resolveWithObject: true });
  return { ...image, bytes: data, width: info.width, height: info.height, extension: "jpg", contentType: "image/jpeg", hasAlpha: false };
}

export async function prepareMatchPhoto(input: MatchPhotoInput): Promise<Result<PreparedMatchPhoto>> {
  const quality = await checkPhotoQuality(await upright(input.image), input.upscale);
  if (!quality.ok) return quality;
  const { image } = quality.data;

  const faces = await detectFaces(image.bytes, image.hash);
  const source = { width: image.width, height: image.height };
  const saliency = faces.length > 0 ? null : await saliencyPoint(image.bytes, source);
  const sides: ColumnSide[] = input.frame.orientation === "landscape" ? (input.sides ?? ["right", "left"]) : ["right"];
  const plans = sides.map((side) => {
    const g = input.geometry ? input.geometry(side) : matchResultGeometry(input.frame, side, input.template);
    return { side, g, safe: g.photoSafe, crop: planCrop({ source, frame: input.frame, safe: g.photoSafe, faces, saliency, offset: input.offset, zoom: input.zoom }) };
  });
  const chosen = chooseSide(plans, input.frame, saliency, faces.length > 0) ?? plans[0];
  if (!chosen) return { ok: false, error: { code: "CROP_FAILED", message: "Kırpma planlanamadı." } };

  const art = await cropAndGrade(image.bytes, chosen.crop.box, input.frame, input.accentHex, input.deepHex);
  const luminance = await textRegionLuminance(art, chosen.g);
  return { ok: true, data: { art, shadeStrength: shadeStrengthFor(luminance), luminance, crop: chosen.crop, side: chosen.side, faces, quality: quality.data } };
}
