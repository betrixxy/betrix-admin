import sharp from "sharp";
import { downloadImage, inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import type { Result } from "@/types/result";

/**
 * Tam kadraj maç fotoğrafı kalite kapısı: (1) kısa kenar 1080'in altındaysa Fal.ai `esrgan` ile
 * büyütülür — hattın TEK ücretli adımı; (2) keskinlik (Laplacian varyansı) eşiğin altındaysa —
 * büyütmeden sonra da — kart üretilmez ve sebep gösterilir.
 */

export const PHOTO_MIN_SHORT_SIDE = 1080;
/**
 * Bilgi uyarısı eşiği (engellemez): gerçek kullanımda kaynak ≥2000px önerilir; kısa kenarı bunun
 * altındaki kaynak upscale ile kurtarılsa da doku yumuşar (bkz. 2026-10-18 test fotoğrafları).
 */
export const PHOTO_RECOMMENDED_SHORT_SIDE = 1500;
export const SMALL_PHOTO_WARNING = "Fotoğraf küçük, sonuç yumuşak olabilir — daha büyük kaynak önerilir";
/** Keskinlik ölçümü bu uzun kenara küçültülmüş gri görselde yapılır — çözünürlükten bağımsız. */
const MEASURE_LONG_SIDE = 1024;
/**
 * Bu varyansın altı "yumuşak" sayılır. Kalibrasyon: net maç fotoğrafları 1024px'te ~150-1500,
 * σ=3 gauss bulanıklığı uygulanmış aynı fotoğraflar ~10-25 (bkz. tests/unit/match-photo.test.ts).
 */
export const MIN_SHARPNESS = 45;
/** Real-ESRGAN üst sınırı — `lib/services/fal/upscale.ts::MAX_UPSCALE_FACTOR` ile aynı (Fal yalnızca gerektiğinde yüklenir). */
const MAX_UPSCALE_FACTOR = 4;

/** 4-komşulu Laplacian'ın varyansı — gri, tek kanallı piksel dizisi. Kenar pikselleri atlanır. */
export function laplacianVariance(grey: Uint8Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value = (grey[i - 1] ?? 0) + (grey[i + 1] ?? 0) + (grey[i - width] ?? 0) + (grey[i + width] ?? 0) - 4 * (grey[i] ?? 0);
      sum += value;
      sumSq += value * value;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export async function measureSharpness(bytes: Buffer): Promise<number> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: MEASURE_LONG_SIDE, height: MEASURE_LONG_SIDE, fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return laplacianVariance(new Uint8Array(data.buffer, data.byteOffset, data.length), info.width, info.height);
}

/** Kısa kenarı hedefe taşıyan büyütme katsayısı (1 = gerekmez). */
export function photoUpscaleFactor(image: Pick<UploadedImage, "width" | "height">): number {
  const shortSide = Math.min(image.width, image.height);
  if (shortSide >= PHOTO_MIN_SHORT_SIDE) return 1;
  return Math.min(MAX_UPSCALE_FACTOR, Math.ceil(PHOTO_MIN_SHORT_SIDE / shortSide));
}

/** Büyütücü — testte/offline'da Fal'sız sahtesi verilir. */
export type PhotoUpscaler = (image: UploadedImage, scale: number) => Promise<Result<UploadedImage>>;

/** Fal servisi (ve env doğrulaması) yalnızca büyütme gerçekten gerektiğinde yüklenir. */
export const falPhotoUpscaler: PhotoUpscaler = async (image, scale) => {
  const { upscaleImage } = await import("@/lib/services/fal");
  const upscaled = await upscaleImage({ bytes: image.bytes, contentType: image.contentType, scale });
  if (!upscaled.ok) return { ok: false, error: { code: upscaled.error.code, message: `Maç fotoğrafı büyütülemedi (AI Upscale): ${upscaled.error.message}` } };
  try {
    return await inspectImageBytes(await downloadImage(upscaled.data.imageUrl), "Büyütülmüş maç fotoğrafı");
  } catch {
    return { ok: false, error: { code: "DOWNLOAD_FAILED", message: "Büyütülmüş maç fotoğrafı indirilemedi." } };
  }
};

export interface PhotoQuality {
  image: UploadedImage;
  upscaled: boolean;
  sharpness: number;
  /** Ücretli Fal çağrısı (0 ya da 1). */
  paidCalls: number;
  /** Bilgi seviyesinde uyarılar — kart yine üretilir, formda gösterilir. */
  warnings: string[];
}

export async function checkPhotoQuality(image: UploadedImage, upscale: PhotoUpscaler = falPhotoUpscaler): Promise<Result<PhotoQuality>> {
  const scale = photoUpscaleFactor(image);
  let current = image;
  if (scale > 1) {
    const result = await upscale(image, scale);
    if (!result.ok) return result;
    current = result.data;
  }
  const sharpness = await measureSharpness(current.bytes);
  if (sharpness < MIN_SHARPNESS) {
    const after = scale > 1 ? " (AI büyütmeden sonra da)" : "";
    return {
      ok: false,
      error: {
        code: "PHOTO_TOO_SOFT",
        message: `Fotoğraf yeterince net değil${after}: keskinlik ${Math.round(sharpness)} < ${MIN_SHARPNESS}. Daha net bir kare seçin — kart üretilmedi.`,
      },
    };
  }
  // Uyarı KAYNAK boyutuna bakar: upscale edilmiş görsel büyük görünse de doku kaynağınkidir.
  const shortSide = Math.min(image.width, image.height);
  const warnings = shortSide < PHOTO_RECOMMENDED_SHORT_SIDE ? [`${SMALL_PHOTO_WARNING} (kısa kenar ${shortSide}px).`] : [];
  return { ok: true, data: { image: current, upscaled: scale > 1, sharpness, paidCalls: scale > 1 ? 1 : 0, warnings } };
}
