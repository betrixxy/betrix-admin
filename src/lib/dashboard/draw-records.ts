import { z } from "zod";
import { drawRequestSchema, type DrawRequest } from "@/lib/draw/state-schema";
import { prisma } from "@/lib/prisma";

/**
 * Kayıtlı kura kartları (`AiContent`, DRAWS_AND_PAIRINGS): stüdyoda listelenir, kaldığı yerden açılır ve
 * kura sonrası API fikstürüyle karşılaştırılır. Girilen eşleşmeler `renderOptions` içinde saklıdır.
 */

export const drawRecordOptionsSchema = drawRequestSchema.extend({
  kind: z.literal("DRAW"),
  imageUrl: z.string().min(1),
  title: z.string(),
  subtitle: z.string(),
  photoId: z.string().nullable().optional(),
  carousel: z.array(z.object({ url: z.string().min(1), label: z.string() })).optional(),
});

export interface DrawRecordSummary {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
}

export async function listDrawRecords(limit = 12): Promise<DrawRecordSummary[]> {
  const rows = await prisma.aiContent.findMany({
    where: { contentType: "DRAWS_AND_PAIRINGS", resultImageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, status: true, createdAt: true, renderOptions: true },
  });
  return rows.flatMap((row) => {
    const options = drawRecordOptionsSchema.safeParse(row.renderOptions);
    return options.success ? [{ id: row.id, title: options.data.title, subtitle: options.data.subtitle, status: row.status, createdAt: row.createdAt.toISOString() }] : [];
  });
}

/** Kayıttaki kura isteği (stüdyoyu kaldığı yerden açmak için); kayıt yoksa ya da kura değilse null. */
export async function getDrawRecord(id: string): Promise<(DrawRequest & { photoId: string | null }) | null> {
  const row = await prisma.aiContent.findUnique({ where: { id }, select: { contentType: true, renderOptions: true } });
  if (row?.contentType !== "DRAWS_AND_PAIRINGS") return null;
  const options = drawRecordOptionsSchema.safeParse(row.renderOptions);
  if (!options.success) return null;
  const { variant, format, states, roundIds, focusTeamId, photoId } = options.data;
  return { variant, format, states, roundIds, focusTeamId, photoId: photoId ?? null };
}
