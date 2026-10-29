import { z } from "zod";
import { carouselUrls } from "@/lib/dashboard/publish-caption";
import { CONTENT_TYPE_IDS, type ContentTypeId } from "@/types/content-type";

/**
 * Maç Sonucu carousel'inin içerdiği içerik türleri (saf). Yeni kayıtlar `renderOptions.pages` taşır
 * (`["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS"]` — sırayla 01, 02, 03); alanı olmayan eski carousel
 * (01 + 02) Maç İstatistikleri'ni de karşılar. Carousel'siz kayıt yalnızca kendi türüdür.
 */

const pagesSchema = z.object({ pages: z.array(z.enum(CONTENT_TYPE_IDS)).min(1) });

export function setPages(contentType: ContentTypeId, renderOptions: unknown): ContentTypeId[] {
  if (contentType !== "MATCH_RESULT") return [contentType];
  const pages = pagesSchema.safeParse(renderOptions);
  if (pages.success) return [...new Set<ContentTypeId>(["MATCH_RESULT", ...pages.data.pages])];
  return carouselUrls(renderOptions).length >= 2 ? ["MATCH_RESULT", "MATCH_STATS"] : ["MATCH_RESULT"];
}
