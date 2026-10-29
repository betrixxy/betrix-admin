/**
 * Kullanılacak Fal.ai model endpoint'leri (bkz. CLAUDE.md Bölüm 3).
 */
export const FAL_MODELS = {
  BACKGROUND_REMOVAL: "fal-ai/birefnet/v2",
  STADIUM_BACKGROUND: "fal-ai/flux/dev",
  /** Maç Günü kompozitini tek parça postere harmanlama (image-to-image). */
  HARMONIZE: "fal-ai/flux/dev/image-to-image",
  /** Küçük oyuncu fotoğraflarını birefnet öncesi netleştirerek büyütme (super-resolution). */
  UPSCALE: "fal-ai/esrgan",
} as const;
