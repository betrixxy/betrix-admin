import sharp from "sharp";
import { falPhotoUpscaler, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { parseStoredFileUrl, readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";
import { inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import type { Result } from "@/types/result";

/**
 * Arşiv dosyaları. ORİJİNAL hiçbir zaman yeniden sıkıştırılmaz: yüklenen baytlar olduğu gibi,
 * orijinal formatında yazılır (`archive-<sha256>.<uzantı>`). Kısa kenar 2000'in altındaysa kart
 * üretimi için ayrıca Fal ESRGAN ile büyütülmüş sürüm tutulur (`archive-<sha256>-s2000.jpg`) —
 * tek ücretli çağrı, kaynak SHA-256 ile önbellekli (`falPhotoUpscaler`). Arşiv orijinali gösterir.
 */

export const ARCHIVE_TARGET_SHORT_SIDE = 2000;
const MAX_UPSCALE_FACTOR = 4;

/** Kısa kenarı 2000'e taşıyan ESRGAN katsayısı (1 = gerekmez). */
export function archiveUpscaleFactor(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  if (shortSide >= ARCHIVE_TARGET_SHORT_SIDE) return 1;
  return Math.min(MAX_UPSCALE_FACTOR, Math.ceil(ARCHIVE_TARGET_SHORT_SIDE / shortSide));
}

/** Yüklenen orijinali olduğu gibi kaydeder (içerik-adresli; aynı dosya ikinci kez yazılmaz). */
export function storeArchiveOriginal(image: UploadedImage): Promise<string> {
  return saveStoredFile("library", `archive-${image.hash}.${image.extension}`, image.bytes);
}

/**
 * Kart için büyütülmüş sürüm: ESRGAN tam katsayıyla büyütür, sonra kısa kenar tam 2000 olacak
 * şekilde lanczos ile ayarlanır (JPEG q95). Gerekmiyorsa null. Fal sonucu önbellekte varsa ücretsiz.
 */
export async function createArchiveUpscale(image: UploadedImage, upscale: PhotoUpscaler = falPhotoUpscaler): Promise<Result<string | null>> {
  const scale = archiveUpscaleFactor(image.width, image.height);
  if (scale === 1) return { ok: true, data: null };
  const upscaled = await upscale(image, scale);
  if (!upscaled.ok) return upscaled;
  const portrait = image.height < image.width ? { height: ARCHIVE_TARGET_SHORT_SIDE } : { width: ARCHIVE_TARGET_SHORT_SIDE };
  const bytes = await sharp(upscaled.data.bytes).resize({ ...portrait, kernel: "lanczos3" }).jpeg({ quality: 95 }).toBuffer();
  return { ok: true, data: await saveStoredFile("library", `archive-${image.hash}-s${ARCHIVE_TARGET_SHORT_SIDE}.jpg`, bytes) };
}

async function readUrl(url: string, label: string): Promise<Result<UploadedImage>> {
  const stored = parseStoredFileUrl(url);
  const bytes = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  if (!bytes) return { ok: false, error: { code: "MEDIA_FILE_MISSING", message: `${label} depolamada bulunamadı.` } };
  return inspectImageBytes(bytes, label);
}

export interface CardPhotoSource {
  originalUrl: string;
  upscaledUrl: string | null;
}

/**
 * Kart üretiminin okuyacağı görsel: büyütülmüş sürüm varsa o; yoksa (eski taşınmış fotoğraf —
 * "ilk kullanımda büyüt" kararı) şimdi büyütülür ve `onUpscaled` ile kayda yazılır; gerekmiyorsa
 * orijinal. Büyütme başarısızsa orijinalle devam edilir (kart hattının kendi kalite kapısı var).
 */
export async function photoForCard(
  photo: CardPhotoSource,
  onUpscaled: (url: string) => Promise<void>,
  upscale: PhotoUpscaler = falPhotoUpscaler,
): Promise<Result<{ image: UploadedImage; url: string; upscaledNow: boolean }>> {
  if (photo.upscaledUrl) {
    const image = await readUrl(photo.upscaledUrl, "Büyütülmüş fotoğraf");
    if (image.ok) return { ok: true, data: { image: image.data, url: photo.upscaledUrl, upscaledNow: false } };
  }
  const original = await readUrl(photo.originalUrl, "Arşiv fotoğrafı");
  if (!original.ok) return original;
  const created = await createArchiveUpscale(original.data, upscale);
  if (created.ok && created.data) {
    await onUpscaled(created.data);
    const image = await readUrl(created.data, "Büyütülmüş fotoğraf");
    if (image.ok) return { ok: true, data: { image: image.data, url: created.data, upscaledNow: true } };
  }
  return { ok: true, data: { image: original.data, url: photo.originalUrl, upscaledNow: false } };
}
