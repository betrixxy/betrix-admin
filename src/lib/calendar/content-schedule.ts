import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ContentTypeId } from "@/types/content-type";
import { APPROVED_STATUSES } from "@/types/ai-content";

/** Placeholder kuralı saf modülde (istemci/test de okur) — buradan da dışa açılır. */
export { isSchedulePlaceholder, SCHEDULE_PLACEHOLDER_WHERE, WITHOUT_SCHEDULE_PLACEHOLDERS } from "@/lib/calendar/schedule-placeholder";
import { SCHEDULE_PLACEHOLDER_WHERE } from "@/lib/calendar/schedule-placeholder";

/**
 * Bir maçın bir içerik türü için yayın zamanını ayarlar (`publishAt = null` planı kaldırır).
 * Türün reddedilmemiş kayıtları varsa yalnızca `publishAt` güncellenir; hiç kayıt yoksa
 * placeholder oluşturulur. Plan kaldırılınca, artık hiçbir şey taşımayan placeholder silinir.
 */
export async function setContentSchedule(fixtureId: string, contentType: ContentTypeId, publishAt: Date | null): Promise<void> {
  const scope = { fixtureId, contentType, status: { in: ["DRAFT", ...APPROVED_STATUSES] } } satisfies Prisma.AiContentWhereInput;

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
      where: { fixtureId, contentType, status: { in: ["DRAFT", ...APPROVED_STATUSES] }, publishAt: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { publishAt: true },
    }),
  ]);
  return { placeholderId: placeholder?.id ?? null, publishAt: scheduled?.publishAt ?? null };
}
