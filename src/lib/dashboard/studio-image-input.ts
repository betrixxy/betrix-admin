import { addMediaAsset, loadMediaAssetImage } from "@/lib/dashboard/media-library";
import { PLAYER_MIN_SHORT_SIDE, inspectImageUpload, type UploadedImage } from "@/lib/dashboard/studio-images";
import type { MediaCategory } from "@/types/media";
import type { Result } from "@/types/result";

/** Boş bırakılan `<input type="file">` da bir `File` (0 bayt) olarak gelir — yok sayılır. */
function readFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Dosya adından kütüphane etiketi — "gs-logo_beyaz.png" → "gs logo beyaz". */
function labelFromFileName(file: File, fallback: string): string {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 120) || fallback;
}

export interface ResolvedImage {
  image: UploadedImage;
  /** Kütüphanedeki kalıcı URL. */
  fileUrl: string;
}

/**
 * Stüdyo görsel alanı: kütüphaneden seçilen varlık (`<alan>AssetId`) önceliklidir; yoksa yeni
 * yüklenen dosya (`<alan>`) doğrulanır ve kütüphaneye kaydedilir (içerik-adresli — tekrar yükleme
 * kopya üretmez). Böylece bir kez yüklenen logo/oyuncu sonraki üretimlerde listeden seçilebilir.
 */
export async function resolveStudioImage(
  formData: FormData,
  field: string,
  category: MediaCategory,
  label: string,
): Promise<Result<ResolvedImage | null>> {
  const assetId = formData.get(`${field}AssetId`);
  if (typeof assetId === "string" && assetId.length > 0) {
    return loadMediaAssetImage(assetId, category);
  }

  const file = readFile(formData, field);
  if (!file) return { ok: true, data: null };

  const minShortSide = category === "PLAYER" ? PLAYER_MIN_SHORT_SIDE : undefined;
  const inspected = await inspectImageUpload(file, label, minShortSide ? { minShortSide } : {});
  if (!inspected.ok) return inspected;

  const { asset } = await addMediaAsset({ image: inspected.data, category, label: labelFromFileName(file, label) });
  return { ok: true, data: { image: inspected.data, fileUrl: asset.fileUrl } };
}
