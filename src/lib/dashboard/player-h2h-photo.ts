import sharp from "sharp";
import { detectFaces } from "@/lib/dashboard/match-photo/faces";
import type { UploadedImage } from "@/lib/dashboard/studio-images";

/**
 * Karşılaştırma sayfasının küçük yüz fotoğrafı: yerel yüz tespiti (YuNet, `match-photo/faces.ts`) ile
 * en büyük yüz bulunur, yüz merkezli kare kırpılır (saç ve çene sığsın diye yüzün 2,1 katı). Yüz yoksa
 * null — şablon takım logosunu çizer (yanlış yeri kırpmaktansa).
 */

const FACE_SCALE = 2.1;
const THUMB_SIZE = 256;

export async function faceThumb(image: UploadedImage): Promise<string | null> {
  const faces = await detectFaces(image.bytes, image.hash);
  const face = [...faces].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!face) return null;
  const side = Math.min(image.width, image.height, Math.round(Math.max(face.width, face.height) * FACE_SCALE));
  const cx = face.x + face.width / 2;
  // Yüz karenin biraz üstünde dursun (omuz başlangıcı görünsün).
  const cy = face.y + face.height * 0.62;
  const left = Math.round(Math.min(Math.max(0, cx - side / 2), image.width - side));
  const top = Math.round(Math.min(Math.max(0, cy - side / 2), image.height - side));
  const jpeg = await sharp(image.bytes).rotate().extract({ left, top, width: side, height: side }).resize(THUMB_SIZE, THUMB_SIZE).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
