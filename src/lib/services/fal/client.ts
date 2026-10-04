import { fal } from "@fal-ai/client";
import { env } from "@/lib/env";

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

/** FAL_KEY .env.local'da tanımlanana kadar servis çağrıları `NOT_CONFIGURED` hatasıyla reddedilir. */
export function isFalConfigured(): boolean {
  return env.FAL_KEY.length > 0;
}

let configured = false;

/** `fal` SDK singleton'ını FAL_KEY ile bir kez yapılandırıp döner (bkz. CLAUDE.md 1.4 — servis katmanı dışına sızmaz). */
export function getFalClient(): typeof fal {
  if (!configured) {
    fal.config({ credentials: env.FAL_KEY });
    configured = true;
  }
  return fal;
}

const FAL_MAX_SIDE = 1536;
const FAL_SIZE_MULTIPLE = 32;

function clampDimension(value: number, scale: number): number {
  const scaled = Math.max(FAL_SIZE_MULTIPLE, value * scale);
  return Math.round(scaled / FAL_SIZE_MULTIPLE) * FAL_SIZE_MULTIPLE;
}

/**
 * Hedef format boyutunu, en-boy oranını koruyarak Fal'ın kabul ettiği aralığa ölçekler
 * (en uzun kenar ≤1536px, her kenar 32'nin katı). Tam piksel eşleşmesi şart değildir —
 * nihai kompozisyonda (bkz. studio-render.ts) görsel kanvasa `slice` ile kırpılarak oturtulur.
 */
export function toFalImageSize(width: number, height: number): { width: number; height: number } {
  const longSide = Math.max(width, height);
  const scale = longSide > FAL_MAX_SIDE ? FAL_MAX_SIDE / longSide : 1;
  return { width: clampDimension(width, scale), height: clampDimension(height, scale) };
}
