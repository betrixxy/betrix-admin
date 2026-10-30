import { PLAYER_TARGET_SHORT_SIDE } from "@/lib/dashboard/image-limits";
import { downloadImage, inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import { MAX_UPSCALE_FACTOR, upscaleImage } from "@/lib/services/fal";
import { lowResolutionWarning } from "@/lib/dashboard/match-photo/quality";
import { reportJobNote } from "@/lib/jobs/studio-jobs";
import type { Result } from "@/types/result";

/** Hedef kısa kenara ulaşmak için gereken katsayı (ör. 554px → 2). Yeterince büyükse 1. */
export function upscaleFactorFor(image: Pick<UploadedImage, "width" | "height">): number {
  const shortSide = Math.min(image.width, image.height);
  if (shortSide >= PLAYER_TARGET_SHORT_SIDE) return 1;
  return Math.min(MAX_UPSCALE_FACTOR, Math.ceil(PLAYER_TARGET_SHORT_SIDE / shortSide));
}

/**
 * birefnet'ten HEMEN önce çalışır (bkz. CLAUDE.md 3.1 adım 1): kısa kenarı
 * PLAYER_TARGET_SHORT_SIDE'ın altındaki oyuncu fotoğrafını Fal.ai ESRGAN ile netleştirerek
 * büyütür. Zaten yeterince büyük görsel olduğu gibi döner (ücretsiz, ağ çağrısı yok). Büyütme yapılamazsa (Fal yok /
 * hata / zaman aşımı) ORİJİNALLE devam edilir, "Düşük çözünürlük" notu işe düşer — kesim sırf büyütme yüzünden düşmez.
 * `upscale` testte enjekte edilir.
 */
export async function ensurePlayerResolution(image: UploadedImage, label: string, upscale: typeof upscaleImage = upscaleImage): Promise<Result<UploadedImage>> {
  const scale = upscaleFactorFor(image);
  if (scale === 1) return { ok: true, data: image };

  const original = (reason: string): Result<UploadedImage> => {
    reportJobNote(`${label}: ${lowResolutionWarning(reason)}`);
    return { ok: true, data: image };
  };
  const upscaled = await upscale({ bytes: image.bytes, contentType: image.contentType, scale });
  if (!upscaled.ok) return original(upscaled.error.message);

  try {
    const inspected = await inspectImageBytes(await downloadImage(upscaled.data.imageUrl), label);
    return inspected.ok ? inspected : original(inspected.error.message);
  } catch {
    return original("büyütülmüş görsel indirilemedi");
  }
}
