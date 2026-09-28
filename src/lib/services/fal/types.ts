import { z } from "zod";

export interface FalError {
  code: "NOT_CONFIGURED" | "UPLOAD_FAILED" | "REQUEST_FAILED" | "INVALID_RESPONSE";
  message: string;
  cause?: unknown;
}

const falImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

/** `fal-ai/birefnet/v2` ham yanıt şeması — yalnızca kullandığımız alanlar doğrulanır. */
export const birefnetOutputSchema = z.object({ image: falImageSchema });

/** `fal-ai/flux/dev` ham yanıt şeması — yalnızca kullandığımız alanlar doğrulanır. */
export const fluxOutputSchema = z.object({ images: z.array(falImageSchema).min(1) });

export interface RemovePlayerBackgroundResult {
  /** Fal.ai'nin geçici depolamasındaki URL — çağıran kod bunu kalıcı depolamaya indirmelidir. */
  transparentImageUrl: string;
  width?: number;
  height?: number;
}

export interface GenerateStadiumBackgroundResult {
  /** Fal.ai'nin geçici depolamasındaki URL — çağıran kod bunu kalıcı depolamaya indirmelidir. */
  imageUrl: string;
  /** Flux'a gönderilen nihai prompt — hata ayıklama ve tekrar üretim için saklanır. */
  prompt: string;
  width?: number;
  height?: number;
}
