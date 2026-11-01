import { prisma } from "@/lib/prisma";
import { likeLiteral, vitrinFileBlocked, type VitrinFileOwner } from "@/lib/prediction/vitrin-file-rule";

/**
 * Onaysız VITRIN görselleri DIŞARI verilmez (kurucu kararı 2026-10-20; 2026-11-01'de netleşti): imzalı, oturumsuz
 * `/api/public-media` (Instagram'ın indirdiği adres) taslak (DRAFT) ya da reddedilmiş vitrinin görselini 403 ile
 * reddeder; onaydan (APPROVED) ve yayından (PUBLISHED) sonra servis edilir. Oturum açmış admin ise görseli her yerde
 * görür (onay kuyruğu, taslak, indirme): `/api/files` yalnızca oturum sorar, oturumsuz 403
 * (`storage-file-handler.ts`). Kural yalnızca `renders` kovasındaki kart görsellerine uygulanır.
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
