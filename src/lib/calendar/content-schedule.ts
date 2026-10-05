import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ContentTypeId } from "@/types/content-type";

/**
 * İçerik planlama (yayın zamanı) — `AiContent.publishAt`. İçerik henüz üretilmemişse plan, görseli
 * olmayan bir DRAFT "placeholder" kaydında tutulur; stüdyo o tür için ilk üretimi bu kaydın
 * üzerine yazar (bkz. match-day-engine.ts). Gerçek taslakların her zaman bir render çıktısı
 * vardır, bu yüzden placeholder = `status: DRAFT` + `resultImageUrl: null`.
 *
 * Placeholder bir taslak değildir: onay kuyruğuna, taslak sayaçlarına ve onay/ret kararına
 * girmez — bu sorgular `WITHOUT_SCHEDULE_PLACEHOLDERS` ile süzülür.
 */
export const SCHEDULE_PLACEHOLDER_WHERE = { status: "DRAFT", resultImageUrl: null } satisfies Prisma.AiContentWhereInput;

/** Placeholder'lar dışındaki tüm kayıtlar (gerçek taslak/onaylı/reddedilen içerik). */
export const WITHOUT_SCHEDULE_PLACEHOLDERS = { NOT: SCHEDULE_PLACEHOLDER_WHERE } satisfies Prisma.AiContentWhereInput;

export function isSchedulePlaceholder(row: { status: string; resultImageUrl: string | null }): boolean {
  return row.status === "DRAFT" && row.resultImageUrl === null;
}

/**
 * Bir maçın bir içerik türü için yayın zamanını ayarlar (`publishAt = null` planı kaldırır).
 * Türün reddedilmemiş kayıtları varsa yalnızca `publishAt` güncellenir; hiç kayıt yoksa
 * placeholder oluşturulur. Plan kaldırılınca, artık hiçbir şey taşımayan placeholder silinir.
 */
export async function setContentSchedule(fixtureId: string, contentType: ContentTypeId, publishAt: Date | null): Promise<void> {
  const scope = { fixtureId, contentType, status: { in: ["DRAFT", "APPROVED"] } } satisfies Prisma.AiContentWhereInput;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.aiContent.updateMany({ where: scope, data: { publishAt } });
    if (publishAt === null) {
      await tx.aiContent.deleteMany({ where: { fixtureId, contentType, ...SCHEDULE_PLACEHOLDER_WHERE } });
    } else if (count === 0) {
      await tx.aiContent.create({ data: { fixtureId, contentType, publishAt, status: "DRAFT", prompt: "" } });
    }
  });
}

/**
 * Stüdyo üretiminin kaydı: bu maç+tür için planlama placeholder'ı varsa üretim onun üzerine
 * yazılır (plan korunur), yoksa yeni kayıt türün planlanmış yayın zamanını devralır.
 */
export async function createScheduledContent(
  data: Prisma.AiContentUncheckedCreateInput & { contentType: ContentTypeId },
): Promise<{ id: string }> {
  const { placeholderId, publishAt } = await findContentSchedule(data.fixtureId, data.contentType);
  if (placeholderId) {
    return prisma.aiContent.update({ where: { id: placeholderId }, data: { ...data, createdAt: new Date() }, select: { id: true } });
  }
  return prisma.aiContent.create({ data: { publishAt, ...data }, select: { id: true } });
}

async function findContentSchedule(
  fixtureId: string,
  contentType: ContentTypeId,
): Promise<{ placeholderId: string | null; publishAt: Date | null }> {
  const [placeholder, scheduled] = await Promise.all([
    prisma.aiContent.findFirst({
      where: { fixtureId, contentType, ...SCHEDULE_PLACEHOLDER_WHERE },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.aiContent.findFirst({
      where: { fixtureId, contentType, status: { in: ["DRAFT", "APPROVED"] }, publishAt: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { publishAt: true },
    }),
  ]);
  return { placeholderId: placeholder?.id ?? null, publishAt: scheduled?.publishAt ?? null };
}
