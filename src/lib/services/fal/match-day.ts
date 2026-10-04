import { ApiError } from "@fal-ai/client";
import { FAL_MODELS, getFalClient, isFalConfigured, toFalImageSize } from "@/lib/services/fal/client";
import {
  buildMatchDayBackgroundPrompt,
  buildMatchDayHarmonizePrompt,
  type MatchDayPromptInput,
} from "@/lib/services/fal/match-day-prompts";
import { fluxOutputSchema, type FalError } from "@/lib/services/fal/types";
import type { Result } from "@/types/result";

export interface FalGeneratedImage {
  /** Fal.ai'nin geçici depolamasındaki URL — çağıran kod kalıcı depolamaya indirmelidir. */
  imageUrl: string;
  prompt: string;
}

const NOT_CONFIGURED: { ok: false; error: FalError } = {
  ok: false,
  error: { code: "NOT_CONFIGURED", message: "FAL_KEY tanımlı değil — .env.local dosyasını doldurun." },
};

function requestFailed(cause: unknown, fallback: string): { ok: false; error: FalError } {
  const message = cause instanceof ApiError || cause instanceof Error ? cause.message : "";
  return { ok: false, error: { code: "REQUEST_FAILED", message: message || fallback, cause } };
}

function firstImage(data: unknown, model: string, prompt: string): Result<FalGeneratedImage, FalError> {
  const parsed = fluxOutputSchema.safeParse(data);
  const image = parsed.success ? parsed.data.images[0] : undefined;
  if (!image) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: `${model} yanıtı beklenen şemaya uymuyor.` } };
  }
  return { ok: true, data: { imageUrl: image.url, prompt } };
}

export interface MatchDayBackgroundInput extends MatchDayPromptInput {
  width: number;
  height: number;
}

/** Takım renklerine bölünmüş Maç Günü stadyum arka planı — Fal.ai `flux/dev` (text-to-image). */
export async function generateMatchDayBackground(
  input: MatchDayBackgroundInput,
): Promise<Result<FalGeneratedImage, FalError>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const prompt = buildMatchDayBackgroundPrompt(input);

  try {
    const result = await getFalClient().subscribe(FAL_MODELS.STADIUM_BACKGROUND, {
      input: {
        prompt,
        image_size: toFalImageSize(input.width, input.height),
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: false,
    });
    return firstImage(result.data, FAL_MODELS.STADIUM_BACKGROUND, prompt);
  } catch (cause) {
    return requestFailed(cause, "Maç Günü arka planı üretilemedi.");
  }
}

export interface HarmonizeInput extends MatchDayPromptInput {
  /** Kaba kompozit (arka plan + oyuncu kesimleri), PNG/JPEG baytları. */
  composite: Buffer;
  contentType: string;
  /** 0-1: düşük değer kompozisyonu ve yüzleri korur, yüksek değer daha çok "yeniden çizer". */
  strength: number;
}

/**
 * Kaba kompoziti Fal.ai `flux/dev/image-to-image` ile tek parça bir postere harmanlar: ışık,
 * renk tonu, kenar geçişleri ve netlik. Tipografi bu adıma girmez — sonrasında programatik
 * olarak üstüne basılır (bkz. CLAUDE.md 3.4, veri katmanı her zaman programatiktir).
 */
export async function harmonizeMatchDayComposite(input: HarmonizeInput): Promise<Result<FalGeneratedImage, FalError>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const client = getFalClient();
  const prompt = buildMatchDayHarmonizePrompt(input);

  let imageUrl: string;
  try {
    imageUrl = await client.storage.upload(new Blob([new Uint8Array(input.composite)], { type: input.contentType }));
  } catch (cause) {
    return { ok: false, error: { code: "UPLOAD_FAILED", message: "Kompozit görsel Fal.ai'ye yüklenemedi.", cause } };
  }

  try {
    const result = await client.subscribe(FAL_MODELS.HARMONIZE, {
      input: {
        image_url: imageUrl,
        prompt,
        strength: input.strength,
        // 28 adım: flux/dev için kalite platosu (40 ile görsel fark yok, süre/maliyet daha düşük).
        // Düşük guidance (3.0) daha doğal, "fotoğraf gibi" sonuç verir; yüksek değer plastikleştirir.
        num_inference_steps: 28,
        guidance_scale: 3.0,
        num_images: 1,
        output_format: "png",
        enable_safety_checker: true,
      },
      logs: false,
    });
    return firstImage(result.data, FAL_MODELS.HARMONIZE, prompt);
  } catch (cause) {
    return requestFailed(cause, "Görsel harmanlama (image-to-image) başarısız oldu.");
  }
}
