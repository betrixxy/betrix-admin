import { createHash } from "node:crypto";
import { readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { ensurePlayerResolution, upscaleFactorFor } from "@/lib/dashboard/player-upscale";
import { removePlayerBackground } from "@/lib/services/fal";
import type { Result } from "@/types/result";

/**
 * Maç Günü maliyet optimizasyonu — içerik-adresli önbellek (`storage/generated/`):
 *
 * - Oyuncu kesimi: anahtar = orijinal fotoğrafın SHA-256'sı. Kütüphanedeki aynı oyuncu
 *   fotoğrafı ikinci kez kullanıldığında AI Upscale + birefnet çağrısı HİÇ yapılmaz.
 * - Arka plan: anahtar = prompt + boyut. "Arka planı yeniden kullan" seçiliyse aynı şablon/
 *   renk/tansiyon/format için önceden üretilmiş sahne tekrar kullanılır (flux çağrısı yok).
 */

/** Önbellek anahtarı sürümü — kesim/arka plan hattı değişirse artırılır, eski girdiler yok sayılır. */
const CACHE_VERSION = "v1";

export interface CachedAsset {
  bytes: Buffer;
  /** Bu adım için yapılan ücretli Fal.ai çağrısı sayısı (önbellekten geldiyse 0). */
  paidCalls: number;
  fromCache: boolean;
}

function cutoutFileName(image: UploadedImage): string {
  return `cutout-${CACHE_VERSION}-${image.hash}.png`;
}

/** Küçükse AI Upscale → birefnet; sonuç fotoğraf hash'iyle saklanır ve tekrar kullanılır. */
export async function getPlayerCutout(image: UploadedImage, label: string): Promise<Result<CachedAsset>> {
  const fileName = cutoutFileName(image);
  const cached = await readStoredFile("generated", fileName);
  if (cached) return { ok: true, data: { bytes: cached, paidCalls: 0, fromCache: true } };

  const paidUpscale = upscaleFactorFor(image) > 1 ? 1 : 0;
  const ready = await ensurePlayerResolution(image, label);
  if (!ready.ok) return ready;
  const cut = await removePlayerBackground({ bytes: ready.data.bytes, contentType: ready.data.contentType });
  if (!cut.ok) return { ok: false, error: { code: cut.error.code, message: `${label}: ${cut.error.message}` } };

  try {
    // Fal URL'leri geçicidir — hemen indirilir (bkz. CLAUDE.md 3.1 adım 6).
    const bytes = await downloadImage(cut.data.transparentImageUrl);
    await saveStoredFile("generated", fileName, bytes);
    return { ok: true, data: { bytes, paidCalls: paidUpscale + 1, fromCache: false } };
  } catch {
    return { ok: false, error: { code: "DOWNLOAD_FAILED", message: `${label}: oyuncu kesimi indirilemedi.` } };
  }
}

export function backgroundCacheKey(prompt: string, width: number, height: number): string {
  return createHash("sha256").update(`${CACHE_VERSION}|${width}x${height}|${prompt}`).digest("hex");
}

export function readCachedBackground(key: string): Promise<Buffer | null> {
  return readStoredFile("generated", `bg-${key}.jpg`);
}

export async function saveCachedBackground(key: string, jpeg: Buffer): Promise<string> {
  return saveStoredFile("generated", `bg-${key}.jpg`, jpeg);
}
