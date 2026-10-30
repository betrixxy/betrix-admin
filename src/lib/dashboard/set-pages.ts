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

/**
 * Saf: Maç Sonucu kaydına sonradan eklenen oyuncu sayfası — carousel'in sonuna (tek kartta 01 slaytı önce
 * kurulur), `pages`'e PLAYER_STATS, bekleyen kayıt (`pendingPlayerPage`) silinir; kesinleşmemiş veriyle
 * üretildiyse `provisionalPlayerPage`.
 */
export function withPlayerSlide(renderOptions: unknown, base: { url: string; label: string }, slide: { url: string; label: string }, provisional: boolean): Record<string, unknown> {
  const current = renderOptions && typeof renderOptions === "object" ? (renderOptions as Record<string, unknown>) : {};
  const carousel = z.object({ carousel: z.array(z.object({ url: z.string(), label: z.string() })).min(1) }).safeParse(current);
  const slides = carousel.success ? carousel.data.carousel : [base];
  const next: Record<string, unknown> = { ...current, carousel: [...slides, slide], pages: [...setPages("MATCH_RESULT", current), "PLAYER_STATS"] };
  delete next.pendingPlayerPage;
  if (provisional) next.provisionalPlayerPage = true;
  return next;
}
