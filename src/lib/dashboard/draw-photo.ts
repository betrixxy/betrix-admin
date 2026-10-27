import sharp from "sharp";
import { CARD_SHADE_HEX } from "@/lib/dashboard/color-math";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { planCrop, saliencyPoint, type CropOffset } from "@/lib/dashboard/match-photo/crop";
import { detectFaces } from "@/lib/dashboard/match-photo/faces";
import { cropAndGrade } from "@/lib/dashboard/match-photo/grade";
import { checkPhotoQuality, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { noUpscale } from "@/lib/dashboard/vitrin-photo";
import type { DrawPosterGeometry } from "@/skills/render-engine/templates/draw/geometry";
import type { Result } from "@/types/result";

/**
 * Kura kartının sanat katmanları. Poster: takımın arşiv fotoğrafı TAM KADRAJ (Maç Sonucu / vitrin
 * hattının yapı taşları: kalite kapısı, yerel yüz tespiti, akıllı kırpma, split-tone) + takım renginde
 * hafif ışık; fotoğraf yoksa programatik zemin. Izgara sayfası: posterin bulanık/koyu hâli. Liste
 * sayfaları (B, C): koyu zemin + vurgu renginde hafif parıltı. Fal yok (arşiv fotoğrafı büyütülmüş gelir).
 */

export interface PosterAdjust {
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
}

const LIGHT_OPACITY = 0.5;

async function canvas(frame: MatchDayFrame, hex: string, cx = "50%", cy = "30%"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">
    <defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="80%"><stop offset="0" stop-color="${hex}" stop-opacity="0.32"/><stop offset="1" stop-color="${CARD_SHADE_HEX}" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="${CARD_SHADE_HEX}"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Liste sayfalarının zemini (B, C). */
export const listBackground = (frame: MatchDayFrame, hex: string) => canvas(frame, hex, "85%", "10%");

function lightSvg(width: number, height: number, hex: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="l" cx="15%" cy="15%" r="100%"><stop offset="0" stop-color="${hex}" stop-opacity="${LIGHT_OPACITY}"/><stop offset="1" stop-color="${hex}" stop-opacity="0.08"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#l)"/></svg>`);
}

/** Posterin tam kadraj sanatı; fotoğraf yoksa programatik. */
export async function drawPosterArt(image: UploadedImage | null, g: DrawPosterGeometry, hex: string, adjust: PosterAdjust = {}, upscale: PhotoUpscaler = noUpscale): Promise<Result<Buffer>> {
  if (!image) return { ok: true, data: await canvas(g.frame, hex) };
  const quality = await checkPhotoQuality(image, upscale);
  if (!quality.ok) return quality;
  const source = quality.data.image;
  const { region } = g.photo;
  const width = region.right - region.left;
  const height = region.bottom - region.top;
  const faces = await detectFaces(source.bytes, source.hash);
  const dims = { width: source.width, height: source.height };
  const saliency = faces.length > 0 ? null : await saliencyPoint(source.bytes, dims);
  const safe = { left: g.photo.safe.left - region.left, right: g.photo.safe.right - region.left, top: g.photo.safe.top - region.top, bottom: g.photo.safe.bottom - region.top };
  const plan = planCrop({ source: dims, frame: { width, height }, safe, faces, saliency, offset: adjust.offset, zoom: adjust.zoom });
  const graded = await cropAndGrade(source.bytes, plan.box, { ...g.frame, width, height }, hex, undefined);
  const lit = await sharp(graded).composite([{ input: lightSvg(width, height, hex), blend: "soft-light" }]).png().toBuffer();
  const art = await sharp(await canvas(g.frame, hex)).composite([{ input: lit, left: region.left, top: region.top }]).png().toBuffer();
  return { ok: true, data: art };
}
