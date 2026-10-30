import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ContentTypeId } from "@/types/content-type";
import { APPROVED_STATUSES } from "@/types/ai-content";

/** Placeholder kuralı saf modülde (istemci/test de okur) — buradan da dışa açılır. */
export { isSchedulePlaceholder, SCHEDULE_PLACEHOLDER_WHERE, WITHOUT_SCHEDULE_PLACEHOLDERS } from "@/lib/calendar/schedule-placeholder";
import { SCHEDULE_PLACEHOLDER_WHERE } from "@/lib/calendar/schedule-placeholder";

/*
 * Planlama placeholder'ı (`resultImageUrl = null` DRAFT) eskiden maç panelindeki İçerik Kontrol Merkezi'nin
 * takvim ikonuyla (`setContentSchedule`) açılırdı; bileşen 2026-10-30'da kaldırıldı, YENİ placeholder açılmaz.
 * Eski satırlar veritabanında kalabilir: okuyucular (onay kuyruğu, sayaçlar, İçerik Planı) onları süzmeye,
 * stüdyo ilk üretimi onların üzerine yazmaya devam eder.
 */

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
