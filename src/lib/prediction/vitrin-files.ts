import { parseStoredFileUrl, readStoredFile } from "@/lib/dashboard/storage";
import { prisma } from "@/lib/prisma";
import { likeLiteral, SERVABLE_STATUSES, vitrinFileBlocked, type VitrinFileOwner } from "@/lib/prediction/vitrin-file-rule";

/**
 * Onaysız VITRIN görselleri dosya adresinden verilmez (kurucu kararı, 2026-10-20): `/api/files` ve
 * Instagram'ın indirdiği imzalı adres (`/api/public-media`) taslak (DRAFT) ya da reddedilmiş vitrinin
 * görselini 403 ile reddeder; onaydan (APPROVED) ve yayından (PUBLISHED) sonra normal servis edilir.
 * İnceleme ekranı görseli sunucuda gömülü önizleme olarak gösterir (`vitrinReviewSrc`, bkz.
 * `draft-data.ts`). Kural yalnızca `renders` kovasındaki kart görsellerine uygulanır.
 */

/**
 * Dosyanın sahibi vitrin kayıtları (kartın kendisi ya da carousel sayfası). Dosya adları rastgele
 * UUID'dir; `renderOptions` metninde adresin geçmesi carousel sayfasını da yakalar.
 */
async function vitrinOwners(fileUrl: string): Promise<VitrinFileOwner[]> {
  return prisma.$queryRaw<VitrinFileOwner[]>`
    SELECT "status"::text AS "status", "renderOptions"
    FROM "AiContent"
    WHERE "contentType" = 'AI_MARKET_PREDICTION'
      AND ("resultImageUrl" = ${fileUrl} OR "renderOptions"::text LIKE ${`%${likeLiteral(fileUrl)}%`})`;
}

/** `bucket`/`fileName` doğrulanmış olmalı (storage.ts). Vitrin dışı ya da `renders` dışı dosya: false. */
export async function isUnapprovedVitrinFile(bucket: string, fileName: string): Promise<boolean> {
  if (bucket !== "renders") return false;
  return vitrinFileBlocked(await vitrinOwners(`/api/files/${bucket}/${fileName}`));
}

export const VITRIN_FILE_FORBIDDEN = "Onaysız vitrin görseli dosya adresinden verilmez — önce taslağı onaylayın.";

/**
 * İnceleme ekranının vitrin görseli: onaysız taslakta dosya adresi 403 verdiği için görsel sunucuda okunup
 * gömülü (`data:`) gösterilir; onaylı/yayınlanmış vitrin normal adresinden. Okunamazsa adres kalır.
 */
export async function vitrinReviewSrc(url: string, status: string): Promise<string> {
  if (SERVABLE_STATUSES.has(status)) return url;
  const stored = parseStoredFileUrl(url);
  const data = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  return data ? `data:image/png;base64,${data.toString("base64")}` : url;
}
