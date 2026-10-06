import { ApiError } from "@fal-ai/client";
import { FAL_MODELS, getFalClient, isFalConfigured, toFalImageSize } from "@/lib/services/fal/client";
import { buildStadiumPrompt, type StadiumPromptInput } from "@/lib/services/fal/prompt-builder";
import {
  birefnetOutputSchema,
  fluxOutputSchema,
  type FalError,
  type GenerateStadiumBackgroundResult,
  type RemovePlayerBackgroundResult,
} from "@/lib/services/fal/types";
import type { Result } from "@/types/result";

export { isFalConfigured, toFalImageSize };
export { generateFluxScene, generateMatchDayBackground, harmonizeMatchDayComposite } from "@/lib/services/fal/match-day";
export { buildAnalysisHeroPrompt } from "@/lib/services/fal/analysis-hero-prompts";
export type { FalGeneratedImage } from "@/lib/services/fal/match-day";
export { buildMatchDayBackgroundPrompt } from "@/lib/services/fal/match-day-prompts";
export { MAX_UPSCALE_FACTOR, upscaleImage } from "@/lib/services/fal/upscale";
export type { FalError };

const NOT_CONFIGURED_ERROR: FalError = {
  code: "NOT_CONFIGURED",
  message: "FAL_KEY tanımlı değil — .env.local dosyasını doldurun.",
};

function toFalError(cause: unknown, fallbackMessage: string): FalError {
  const message = cause instanceof ApiError || cause instanceof Error ? cause.message : fallbackMessage;
  return { code: "REQUEST_FAILED", message: message || fallbackMessage, cause };
}

export interface UploadableImage {
  bytes: Buffer;
  contentType: string;
}

/**
 * Oyuncu fotoğrafının arka planını Fal.ai `birefnet` modeliyle temizler (bkz. CLAUDE.md 3.1).
 * Görsel önce Fal'ın geçici depolamasına yüklenir (model yalnızca URL kabul eder); dönen
 * sonucun URL'i de geçicidir — çağıran kod bunu kalıcı depolamaya indirip kaydetmekle
 * yükümlüdür (bkz. `app/dashboard/studio/actions.ts`).
 */
export async function removePlayerBackground(
  image: UploadableImage,
): Promise<Result<RemovePlayerBackgroundResult, FalError>> {
  if (!isFalConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR };
  const client = getFalClient();

  let imageUrl: string;
  try {
    imageUrl = await client.storage.upload(new Blob([new Uint8Array(image.bytes)], { type: image.contentType }));
  } catch (cause) {
    return { ok: false, error: { code: "UPLOAD_FAILED", message: "Oyuncu fotoğrafı Fal.ai'ye yüklenemedi.", cause } };
  }

  try {
    const result = await client.subscribe(FAL_MODELS.BACKGROUND_REMOVAL, {
      input: { image_url: imageUrl, refine_foreground: true },
      logs: false,
    });

    const parsed = birefnetOutputSchema.safeParse(result.data);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: "INVALID_RESPONSE", message: "Birefnet yanıtı beklenen şemaya uymuyor.", cause: parsed.error },
      };
    }

    return {
      ok: true,
      data: {
        transparentImageUrl: parsed.data.image.url,
        width: parsed.data.image.width,
        height: parsed.data.image.height,
      },
    };
  } catch (cause) {
    return { ok: false, error: toFalError(cause, "Arka plan temizleme isteği başarısız oldu.") };
  }
}

export interface GenerateStadiumBackgroundInput extends StadiumPromptInput {
  width: number;
  height: number;
}

/**
 * Takım renklerine, derbi tansiyonuna ve seçilen formata uygun stadyum arka planını
 * Fal.ai `flux` ailesiyle üretir (bkz. CLAUDE.md 3.2 — prompt mühendisliği kuralları,
 * `prompt-builder.ts`). Dönen sonucun URL'i geçicidir, bkz. `removePlayerBackground`.
 */
export async function generateStadiumBackground(
  input: GenerateStadiumBackgroundInput,
): Promise<Result<GenerateStadiumBackgroundResult, FalError>> {
  if (!isFalConfigured()) return { ok: false, error: NOT_CONFIGURED_ERROR };

  const prompt = buildStadiumPrompt(input);
  const imageSize = toFalImageSize(input.width, input.height);
  const client = getFalClient();

  try {
    const result = await client.subscribe(FAL_MODELS.STADIUM_BACKGROUND, {
      input: { prompt, image_size: imageSize, num_images: 1, enable_safety_checker: true },
      logs: false,
    });

    const parsed = fluxOutputSchema.safeParse(result.data);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: "INVALID_RESPONSE", message: "Flux yanıtı beklenen şemaya uymuyor.", cause: parsed.error },
      };
    }

    const image = parsed.data.images[0];
    if (!image) {
      return { ok: false, error: { code: "INVALID_RESPONSE", message: "Flux görsel listesi boş döndü." } };
    }

    return { ok: true, data: { imageUrl: image.url, prompt, width: image.width, height: image.height } };
  } catch (cause) {
    return { ok: false, error: toFalError(cause, "Stadyum arka planı üretimi başarısız oldu.") };
  }
}
