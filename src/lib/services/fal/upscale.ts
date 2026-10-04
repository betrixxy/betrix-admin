import { ApiError } from "@fal-ai/client";
import { z } from "zod";
import { FAL_MODELS, getFalClient, isFalConfigured } from "@/lib/services/fal/client";
import type { FalError } from "@/lib/services/fal/types";
import type { Result } from "@/types/result";

/** `fal-ai/esrgan` ham yanıt şeması — yalnızca kullandığımız alan doğrulanır. */
const esrganOutputSchema = z.object({ image: z.object({ url: z.string() }) });

/** Real-ESRGAN x4plus en fazla 4× büyütür; daha fazlası yalnızca bulanık piksel ekler. */
export const MAX_UPSCALE_FACTOR = 4;

export interface UpscaleInput {
  bytes: Buffer;
  contentType: string;
  /** 1-4 arası büyütme katsayısı. */
  scale: number;
}

/**
 * Küçük/düşük çözünürlüklü görseli Fal.ai `esrgan` (Real-ESRGAN x4plus) ile netleştirerek büyütür.
 * Yüz restorasyonu (`face`) kapalıdır: GFPGAN oyuncunun yüz hatlarını değiştirebilir. Dönen URL
 * geçicidir — çağıran kod hemen indirmelidir.
 */
export async function upscaleImage(input: UpscaleInput): Promise<Result<{ imageUrl: string }, FalError>> {
  if (!isFalConfigured()) {
    return { ok: false, error: { code: "NOT_CONFIGURED", message: "FAL_KEY tanımlı değil — .env.local dosyasını doldurun." } };
  }
  const client = getFalClient();

  let imageUrl: string;
  try {
    imageUrl = await client.storage.upload(new Blob([new Uint8Array(input.bytes)], { type: input.contentType }));
  } catch (cause) {
    return { ok: false, error: { code: "UPLOAD_FAILED", message: "Görsel büyütme için Fal.ai'ye yüklenemedi.", cause } };
  }

  try {
    const result = await client.subscribe(FAL_MODELS.UPSCALE, {
      input: {
        image_url: imageUrl,
        scale: Math.min(MAX_UPSCALE_FACTOR, Math.max(1, input.scale)),
        model: "RealESRGAN_x4plus",
        face: false,
        output_format: "png",
      },
      logs: false,
    });
    const parsed = esrganOutputSchema.safeParse(result.data);
    if (!parsed.success) {
      return { ok: false, error: { code: "INVALID_RESPONSE", message: "ESRGAN yanıtı beklenen şemaya uymuyor.", cause: parsed.error } };
    }
    return { ok: true, data: { imageUrl: parsed.data.image.url } };
  } catch (cause) {
    const message = cause instanceof ApiError || cause instanceof Error ? cause.message : "";
    return { ok: false, error: { code: "REQUEST_FAILED", message: message || "AI upscale başarısız oldu.", cause } };
  }
}
