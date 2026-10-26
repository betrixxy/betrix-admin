import sharp from "sharp";
import { detectFaces, type FaceBox } from "@/lib/dashboard/match-photo/faces";
import type { UploadedImage } from "@/lib/dashboard/studio-images";

/**
 * Karşılaştırma sayfasının VESİKALIK portresi (2026-10-27 kararı): yerel yüz tespitiyle (YuNet,
 * `match-photo/faces.ts`) en büyük yüz bulunur; kare kırpma yüzü yatayda ortalar, göz hizasını üst üçte
 * bire koyar, baş + omuzlar kareyi doldurur. Arka plan sade: kenarlar hafif bulanık ve takım renginde
 * tonlu, ortadaki baş-omuz bölgesi keskin (yumuşak elips maske — segmentasyon yok, Fal yok). Yüz
 * bulunamazsa null: şablon takım logosunu çizer, stüdyonun fotoğraf seçicisi uyarır.
 */

export const FACE_NOT_FOUND_WARNING = "Fotoğrafta yüz bulunamadı — 2. sayfada vesikalık yerine takım logosu çizilir. Yüzü belirgin bir fotoğraf seçin.";

/** Kare kenarı = yüz yüksekliği × bu (baş + omuzlar). */
const PORTRAIT_SCALE = 2.6;
/** Göz hizası yüz kutusunun üstünden bu oranda (YuNet kutusu alından çeneye). */
const EYE_LINE = 0.4;
const SIZE = 320;
const BLUR = 9;
const TINT_OPACITY = 0.42;

export interface PortraitCrop {
  left: number;
  top: number;
  side: number;
}

/** Saf: yüz → kare kırpma (göz üst üçte birde, yüz yatayda ortada; görüntü sınırına kıstırılır). */
export function portraitCrop(face: FaceBox, image: { width: number; height: number }): PortraitCrop {
  const side = Math.round(Math.min(image.width, image.height, face.height * PORTRAIT_SCALE));
  const cx = face.x + face.width / 2;
  const eyeY = face.y + face.height * EYE_LINE;
  const left = Math.round(Math.min(Math.max(0, cx - side / 2), image.width - side));
  const top = Math.round(Math.min(Math.max(0, eyeY - side / 3), image.height - side));
  return { left, top, side };
}

const largest = (faces: FaceBox[]) => [...faces].sort((a, b) => b.width * b.height - a.width * a.height)[0];

/** Baş-omuz bölgesi keskin, kenarlar saydam (yumuşak geçiş). */
const maskSvg = () =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs><radialGradient id="m" cx="0.5" cy="0.6" r="0.62" fx="0.5" fy="0.5"><stop offset="0.62" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#m)"/></svg>`);

const tintSvg = (hex: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="100%" height="100%" fill="${hex}" fill-opacity="${TINT_OPACITY}"/></svg>`);

export async function facePortrait(image: UploadedImage, hex: string): Promise<string | null> {
  const face = largest(await detectFaces(image.bytes, image.hash));
  if (!face) return null;
  const crop = portraitCrop(face, image);
  const square = await sharp(image.bytes).rotate().extract({ left: crop.left, top: crop.top, width: crop.side, height: crop.side }).resize(SIZE, SIZE).png().toBuffer();
  const background = await sharp(square).blur(BLUR).modulate({ brightness: 0.7 }).composite([{ input: tintSvg(hex), blend: "soft-light" }]).png().toBuffer();
  const subject = await sharp(square).ensureAlpha().composite([{ input: maskSvg(), blend: "dest-in" }]).png().toBuffer();
  const jpeg = await sharp(background).composite([{ input: subject }]).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
