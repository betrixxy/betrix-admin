import { env } from "@/lib/env";

/**
 * Kullanılacak Fal.ai model endpoint'leri (bkz. CLAUDE.md Bölüm 3).
 * Gerçek SDK entegrasyonu bağlandığında `fal.subscribe(FAL_MODELS.X, ...)` şeklinde kullanılacak.
 */
export const FAL_MODELS = {
  BACKGROUND_REMOVAL: "fal-ai/birefnet/v2",
  STADIUM_BACKGROUND: "fal-ai/flux/dev",
} as const;

/** FAL_KEY .env.local'da tanımlanana kadar servis mock modunda çalışır. */
export function isFalConfigured(): boolean {
  return env.FAL_KEY.length > 0;
}
