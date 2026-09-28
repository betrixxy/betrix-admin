import { deleteStoredFile, parseStoredFileUrl, readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";
import { MEDIA_CATEGORY_META } from "@/lib/dashboard/media-library-meta";
import { inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import { prisma } from "@/lib/prisma";
import type { Result } from "@/types/result";
import type { MediaAssetOption, MediaAssetView, MediaCategory } from "@/types/media";

/**
 * Medya/referans kütüphanesi (bkz. CLAUDE.md 1.11). Tüm kütüphane dosya işlemleri buradan
 * geçer: içerik-adresli kayıt (tekrar yükleme kopya üretmez), kategoriye göre listeleme,
 * stüdyo için bayt yükleme ve referans güvenli silme.
 */

export { MEDIA_CATEGORY_META };

type MediaRow = Awaited<ReturnType<typeof prisma.mediaAsset.findFirstOrThrow>>;

function toView(row: MediaRow): MediaAssetView {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    fileUrl: row.fileUrl,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    hasAlpha: row.hasAlpha,
    teamId: row.teamId,
    teamName: row.teamName,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface AddMediaAssetInput {
  image: UploadedImage;
  category: MediaCategory;
  label: string;
  teamId?: string | null;
  teamName?: string | null;
}

/**
 * Görseli kütüphaneye ekler. Aynı dosya bu kategoride zaten varsa yeni kayıt açılmaz,
 * mevcut kayıt döner (`created: false`) — stüdyodan tekrar tekrar aynı logo yüklense de tek kopya.
 */
export async function addMediaAsset(
  input: AddMediaAssetInput,
): Promise<{ asset: MediaAssetView; created: boolean }> {
  const { image, category } = input;
  const existing = await prisma.mediaAsset.findUnique({
    where: { category_sha256: { category, sha256: image.hash } },
  });
  if (existing) return { asset: toView(existing), created: false };

  const fileName = `${category.toLowerCase()}-${image.hash}.${image.extension}`;
  const fileUrl = await saveStoredFile("library", fileName, image.bytes);
  const row = await prisma.mediaAsset.create({
    data: {
      category,
      label: input.label,
      fileUrl,
      sha256: image.hash,
      contentType: image.contentType,
      width: image.width,
      height: image.height,
      sizeBytes: image.bytes.length,
      hasAlpha: image.hasAlpha,
      teamId: input.teamId ?? null,
      teamName: input.teamName ?? null,
    },
  });
  return { asset: toView(row), created: true };
}

export async function listMediaAssets(category?: MediaCategory): Promise<MediaAssetView[]> {
  const rows = await prisma.mediaAsset.findMany({
    where: category ? { category } : {},
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toView);
}

export async function countMediaAssetsByCategory(): Promise<Record<MediaCategory, number>> {
  const groups = await prisma.mediaAsset.groupBy({ by: ["category"], _count: { _all: true } });
  const counts: Record<MediaCategory, number> = { LOGO: 0, PLAYER: 0, REFERENCE: 0 };
  for (const group of groups) counts[group.category] = group._count._all;
  return counts;
}

export async function getMediaAssetOptions(category: MediaCategory): Promise<MediaAssetOption[]> {
  const rows = await prisma.mediaAsset.findMany({
    where: { category },
    orderBy: [{ teamName: "asc" }, { label: "asc" }],
    select: { id: true, label: true, teamName: true, fileUrl: true },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.teamName && !row.label.includes(row.teamName) ? `${row.label} · ${row.teamName}` : row.label,
    fileUrl: row.fileUrl,
  }));
}

/**
 * Stüdyo için: kütüphanedeki görseli doğrulanmış `UploadedImage` + kalıcı URL olarak yükler.
 * Kategori eşleşmesi zorunludur (ör. logo alanına oyuncu görseli seçilemez).
 */
export async function loadMediaAssetImage(
  id: string,
  category: MediaCategory,
): Promise<Result<{ image: UploadedImage; fileUrl: string }>> {
  const row = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!row || row.category !== category) {
    return { ok: false, error: { code: "MEDIA_NOT_FOUND", message: "Seçilen kütüphane görseli bulunamadı." } };
  }

  const stored = parseStoredFileUrl(row.fileUrl);
  const bytes = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  if (!bytes) {
    return { ok: false, error: { code: "MEDIA_FILE_MISSING", message: `"${row.label}" dosyası depolamada bulunamadı.` } };
  }

  const image = await inspectImageBytes(bytes, row.label, { minShortSide: MEDIA_CATEGORY_META[category].minShortSide });
  return image.ok ? { ok: true, data: { image: image.data, fileUrl: row.fileUrl } } : image;
}

/**
 * Kaydı siler. Dosya yalnızca hiçbir AI içeriği ona referans vermiyorsa diskten silinir —
 * aksi halde o taslakların Fal.ai'siz yeniden render'ı logosuz kalırdı.
 */
export async function deleteMediaAsset(id: string): Promise<{ fileKept: boolean }> {
  const row = await prisma.mediaAsset.delete({ where: { id } });
  const references = await prisma.aiContent.count({
    where: { OR: [{ logoImageUrl: row.fileUrl }, { playerImageUrl: row.fileUrl }] },
  });
  if (references > 0) return { fileKept: true };

  const stored = parseStoredFileUrl(row.fileUrl);
  if (stored) await deleteStoredFile(stored.bucket, stored.fileName);
  return { fileKept: false };
}
