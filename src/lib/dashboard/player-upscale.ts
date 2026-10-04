import { PLAYER_TARGET_SHORT_SIDE } from "@/lib/dashboard/image-limits";
import { downloadImage, inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import { MAX_UPSCALE_FACTOR, upscaleImage } from "@/lib/services/fal";
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
 * büyütür. Zaten yeterince büyük görsel olduğu gibi döner (ücretsiz, ağ çağrısı yok).
 */
export async function ensurePlayerResolution(image: UploadedImage, label: string): Promise<Result<UploadedImage>> {
  const scale = upscaleFactorFor(image);
  if (scale === 1) return { ok: true, data: image };

  const upscaled = await upscaleImage({ bytes: image.bytes, contentType: image.contentType, scale });
  if (!upscaled.ok) {
    return { ok: false, error: { code: upscaled.error.code, message: `${label} büyütülemedi (AI Upscale): ${upscaled.error.message}` } };
  }

  try {
    return await inspectImageBytes(await downloadImage(upscaled.data.imageUrl), label);
  } catch {
    return { ok: false, error: { code: "DOWNLOAD_FAILED", message: `${label} için büyütülmüş görsel indirilemedi.` } };
  }
}
