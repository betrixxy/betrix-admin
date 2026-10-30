import { studioNotesOf } from "@/lib/dashboard/studio-notes";
import { prisma } from "@/lib/prisma";

/** Taslağın stüdyo notları (bkz. `studio-notes.ts`) — taslak ekranı her türde başlığın altında gösterir. */
export async function getDraftStudioNotes(id: string): Promise<string[]> {
  const record = await prisma.aiContent.findUnique({ where: { id }, select: { renderOptions: true } });
  return studioNotesOf(record?.renderOptions ?? null);
}
