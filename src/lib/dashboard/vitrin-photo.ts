import sharp from "sharp";
import { CARD_SHADE_HEX } from "@/lib/dashboard/color-math";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { planCrop, saliencyPoint } from "@/lib/dashboard/match-photo/crop";
import { detectFaces } from "@/lib/dashboard/match-photo/faces";
import { cropAndGrade } from "@/lib/dashboard/match-photo/grade";
import { checkPhotoQuality, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import type { VitrinGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import type { Result } from "@/types/result";

/**
 * Vitrin kartının sanat katmanı: arşiv fotoğrafı Maç Sonucu hattının yapı taşlarıyla (kalite kapısı,
 * yerel yüz tespiti, akıllı kırpma, split-tone) vitrin geometrisinin yazısız bölgesine (`photoSafe`)
 * yerleştirilir. Fotoğraf yoksa programatik koyu zemin (vurgu renginde hafif parıltı). Kart için
 * arşivin büyütülmüş sürümü gelir; büyütücü verilmezse Fal'a gidilmez (offline/test).
 */

export interface VitrinPhotoInput {
  image: UploadedImage | null;
  g: VitrinGeometry;
  accentHex: string;
  upscale?: PhotoUpscaler | undefined;
}

/** Fal'sız büyütücü — büyütme gerekiyorsa hata (offline render ve testler). */
export const noUpscale: PhotoUpscaler = async () => ({ ok: false, error: { code: "UPSCALE_DISABLED", message: "Fotoğraf küçük; offline çizimde büyütme kapalı (kısa kenar ≥ 1080 olmalı)." } });

export async function programmaticArt(frame: MatchDayFrame, accentHex: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">
    <defs><radialGradient id="glow" cx="72%" cy="18%" r="70%"><stop offset="0" stop-color="${accentHex}" stop-opacity="0.32"/><stop offset="1" stop-color="${CARD_SHADE_HEX}" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="${CARD_SHADE_HEX}"/><rect width="100%" height="100%" fill="url(#glow)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function prepareVitrinArt(input: VitrinPhotoInput): Promise<Result<Buffer>> {
  const { g } = input;
  if (!input.image) return { ok: true, data: await programmaticArt(g.frame, input.accentHex) };
  const quality = await checkPhotoQuality(input.image, input.upscale ?? noUpscale);
  if (!quality.ok) return quality;
  const { image } = quality.data;
  const faces = await detectFaces(image.bytes, image.hash);
  const source = { width: image.width, height: image.height };
  const saliency = faces.length > 0 ? null : await saliencyPoint(image.bytes, source);
  const plan = planCrop({ source, frame: g.frame, safe: g.photoSafe, faces, saliency });
  return { ok: true, data: await cropAndGrade(image.bytes, plan.box, g.frame, input.accentHex, undefined) };
}
