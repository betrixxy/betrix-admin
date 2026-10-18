import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import type { Result } from "@/types/result";
import { planCrop, saliencyPoint, type CropOffset, type CropPlan } from "./crop";
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
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
  upscale?: PhotoUpscaler | undefined;
}

export interface PreparedMatchPhoto {
  /** Kart boyutunda, tonlanmış sanat katmanı (PNG). */
  art: Buffer;
  shadeStrength: number;
  luminance: number;
  crop: CropPlan;
  faces: FaceBox[];
  quality: PhotoQuality;
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
  const g = matchResultGeometry(input.frame);
  const crop = planCrop({
    source,
    frame: input.frame,
    safe: g.photoSafe,
    faces,
    saliency: faces.length > 0 ? null : await saliencyPoint(image.bytes, source),
    offset: input.offset,
    zoom: input.zoom,
  });

  const art = await cropAndGrade(image.bytes, crop.box, input.frame, input.accentHex, input.deepHex);
  const luminance = await textRegionLuminance(art, g);
  return { ok: true, data: { art, shadeStrength: shadeStrengthFor(luminance), luminance, crop, faces, quality: quality.data } };
}
