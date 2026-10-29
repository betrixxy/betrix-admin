import { FAL_MODELS } from "./models";

/**
 * Model başına üst süre (ms) — Fal kuyruğu takılırsa iş sonsuza kadar beklemez, admin anlaşılır hata görür.
 * Tipik süreler: ESRGAN 5–15 sn, birefnet 5–20 sn, flux 10–40 sn; soğuk başlatma 60 sn'yi bulabilir.
 */
export const FAL_TIMEOUTS_MS: Readonly<Record<(typeof FAL_MODELS)[keyof typeof FAL_MODELS], number>> = {
  [FAL_MODELS.BACKGROUND_REMOVAL]: 120_000,
  [FAL_MODELS.STADIUM_BACKGROUND]: 150_000,
  [FAL_MODELS.HARMONIZE]: 150_000,
  [FAL_MODELS.UPSCALE]: 120_000,
};
/** Görselin Fal depolamasına yüklenmesi için üst süre. */
export const FAL_UPLOAD_TIMEOUT_MS = 60_000;

/** `client.subscribe`'a verilecek iptal sinyali (süre dolunca istek bırakılır). */
export function falTimeoutSignal(model: keyof typeof FAL_TIMEOUTS_MS): AbortSignal {
  return AbortSignal.timeout(FAL_TIMEOUTS_MS[model]);
}

/** Zaman sınırı mı (AbortSignal.timeout → TimeoutError / AbortError)? */
export function isFalTimeout(cause: unknown): boolean {
  return cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError" || /aborted|timed? ?out/iu.test(cause.message));
}

/** Zaman aşımında admin'e gösterilecek tek satır. */
export const falTimeoutMessage = (label: string, ms: number) => `${label}: Fal.ai ${Math.round(ms / 1000)} sn içinde yanıt vermedi — birazdan tekrar deneyin (ücret alınmadıysa tekrar deneme ücretsizdir).`;

/** Fal depolamasına yükleme, süre sınırlı. */
export async function falUpload(client: { storage: { upload: (blob: Blob) => Promise<string> } }, blob: Blob, timeoutMs: number = FAL_UPLOAD_TIMEOUT_MS): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("Fal yüklemesi zaman aşımına uğradı"), { name: "TimeoutError" })), timeoutMs);
  });
  try {
    return await Promise.race([client.storage.upload(blob), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
