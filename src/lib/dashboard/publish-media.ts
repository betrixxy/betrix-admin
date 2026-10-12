import { getContentType } from "@/lib/dashboard/content-types";
import { publishMediaOf } from "@/lib/dashboard/publish-caption";
import { parseStoredFileUrl } from "@/lib/dashboard/storage";
import { prisma } from "@/lib/prisma";
import type { GalleryItem } from "@/types/publishing";

/**
 * Yayın Merkezi'nin görsel kaynakları: taslağın kendi kartları + "Galeriden Görsel Ekle" ile seçilen önceki
 * üretimler. Dizilim yalnızca bu iki kaynaktan oluşabilir — formdan gelen başka adres kabul edilmez.
 */

const GALLERY_LIMIT = 60;
/** Fal.ai (flux/birefnet) ile üretilen içerik türleri; katalog öncesi genel stüdyo taslaklarında tür boştur. */
const AI_CONTENT_TYPES: ReadonlySet<string | null> = new Set([null, "MATCH_DAY"]);

const STAMP = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Önceki üretimler (en yeniden eskiye): reddedilmemiş, görseli olan kayıtlar — açık taslak hariç. */
export async function listPublishGallery(excludeId: string): Promise<GalleryItem[]> {
  const rows = await prisma.aiContent.findMany({
    where: { id: { not: excludeId }, resultImageUrl: { not: null }, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    take: GALLERY_LIMIT,
    select: { id: true, resultImageUrl: true, contentType: true, createdAt: true },
  });
  return rows.flatMap((row) => {
    if (!row.resultImageUrl || !parseStoredFileUrl(row.resultImageUrl)) return [];
    const type = row.contentType ? (getContentType(row.contentType)?.label ?? row.contentType) : "AI İçerik Stüdyosu";
    return [{ id: row.id, url: row.resultImageUrl, label: `${type} · ${STAMP.format(row.createdAt)}`, ai: AI_CONTENT_TYPES.has(row.contentType) }];
  });
}

/**
 * Dizilimde kullanılabilecek adresler: taslağın kendi görselleri + istenen galeri adreslerinden veritabanında
 * gerçekten bir üretime ait olanlar (reddedilmemiş).
 */
export async function allowedMediaUrls(record: { id: string; renderOptions: unknown; resultImageUrl: string | null }, requested: string[]): Promise<string[]> {
  const own = publishMediaOf(record.renderOptions, record.resultImageUrl).map((item) => item.url);
  const extras = [...new Set(requested.filter((url) => !own.includes(url) && parseStoredFileUrl(url)))];
  if (extras.length === 0) return own;
  const found = await prisma.aiContent.findMany({
    where: { id: { not: record.id }, resultImageUrl: { in: extras }, status: { not: "REJECTED" } },
    select: { resultImageUrl: true },
  });
  return [...own, ...found.flatMap((row) => (row.resultImageUrl ? [row.resultImageUrl] : []))];
}
