import { z } from "zod";

/**
 * Stüdyo notları (`renderOptions.studioNotes`) — saf: kartı DÜŞÜRMEYEN geri dönüşler (fotoğrafsız yedek tasarım,
 * Fal yok/hata "Düşük çözünürlük: …", düşen sayfa "02 · … sayfası üretilmedi — …", AI yok). Motorlar ve
 * `createScheduledContent` (çalışan işin `reportJobNote` notları) yazar; taslak ekranı her türde gösterir.
 */

const notesSchema = z.object({ studioNotes: z.array(z.string()) });

/** Kayıttaki notlar (alan yoksa boş), tekrarsız. */
export function studioNotesOf(renderOptions: unknown): string[] {
  const parsed = notesSchema.safeParse(renderOptions);
  return parsed.success ? [...new Set(parsed.data.studioNotes.filter((note) => note.trim().length > 0))] : [];
}

/** Notları renderOptions'a ekler (motorun kendi notlarıyla birlikte, tekrarsız). Nesne olmayan renderOptions'a dokunulmaz. */
export function withStudioNotes<T>(renderOptions: T, notes: string[]): T {
  if (!renderOptions || typeof renderOptions !== "object" || Array.isArray(renderOptions)) return renderOptions;
  const merged = [...new Set([...studioNotesOf(renderOptions), ...notes])];
  if (merged.length === 0) return renderOptions;
  return { ...(renderOptions as Record<string, unknown>), studioNotes: merged } as T;
}
