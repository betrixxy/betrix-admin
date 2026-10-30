import { z } from "zod";
import { carouselUrls } from "@/lib/dashboard/publish-caption";
import { CONTENT_TYPE_IDS, type ContentTypeId } from "@/types/content-type";
import type { MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Maç Sonucu carousel'inin içerdiği içerik türleri (saf). Yeni kayıtlar `renderOptions.pages` taşır
 * (`["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS", "MATCH_ANALYSIS", "PREDICTION_SCORECARD"]`); alanı olmayan eski
 * carousel (01 + 02) Maç İstatistikleri'ni de karşılar. Carousel'siz kayıt yalnızca kendi türüdür.
 *
 * SABİT SAYFA SIRASI (`SET_PAGE_ORDER`): 01 Maç Sonucu → İstatistikler → oyuncu sayfası → Maç Analizi (zaman
 * çizelgesi, devre devre) → Tahmin Karnesi. Yeni kayıtların slaytları türünü (`page`) taşır; sonradan eklenen
 * oyuncu sayfası, set üretilirken yeri AYRILDIYSA (`pendingPlayerPage`) kendi yerine girer (numarası da
 * ayrılmıştı), ayrılmadıysa sona eklenir (numaralar bozulmasın).
 */

export const SET_PAGE_ORDER: readonly ContentTypeId[] = ["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS", "MATCH_ANALYSIS", "PREDICTION_SCORECARD"];

const pagesSchema = z.object({ pages: z.array(z.enum(CONTENT_TYPE_IDS)).min(1) });
const slideSchema = z.object({ url: z.string(), label: z.string(), page: z.enum(CONTENT_TYPE_IDS).optional() }).passthrough();
const carouselSchema = z.object({ carousel: z.array(slideSchema).min(1) });

export type SetSlide = z.infer<typeof slideSchema>;

const byOrder = (a: ContentTypeId, b: ContentTypeId) => SET_PAGE_ORDER.indexOf(a) - SET_PAGE_ORDER.indexOf(b);

export function setPages(contentType: ContentTypeId, renderOptions: unknown): ContentTypeId[] {
  if (contentType !== "MATCH_RESULT") return [contentType];
  const pages = pagesSchema.safeParse(renderOptions);
  if (pages.success) return [...new Set<ContentTypeId>(["MATCH_RESULT", ...pages.data.pages])];
  return carouselUrls(renderOptions).length >= 2 ? ["MATCH_RESULT", "MATCH_STATS"] : ["MATCH_RESULT"];
}

const optionsOf = (renderOptions: unknown) => (renderOptions && typeof renderOptions === "object" ? (renderOptions as Record<string, unknown>) : {});

/**
 * Saf: sonradan eklenecek oyuncu sayfasının carousel dizini (0'dan). Yeri ayrıldıysa (`pendingPlayerPage`) kendisinden
 * sonra gelen ilk sayfanın (Maç Analizi / Tahmin Karnesi) önü; yoksa sonu. Tek kartta (carousel yok) 1.
 */
export function playerSlideIndex(renderOptions: unknown): number {
  const carousel = carouselSchema.safeParse(renderOptions);
  const slides = carousel.success ? carousel.data.carousel : [null];
  if (!("pendingPlayerPage" in optionsOf(renderOptions)) || !carousel.success) return slides.length;
  const after = carousel.data.carousel.findIndex((slide) => slide.page !== undefined && byOrder(slide.page, "PLAYER_STATS") > 0);
  return after < 0 ? slides.length : after;
}

/**
 * Saf: Maç Sonucu kaydına sonradan eklenen oyuncu sayfası — `playerSlideIndex`'e (tek kartta 01 slaytı önce
 * kurulur), `pages`'e PLAYER_STATS, bekleyen kayıt (`pendingPlayerPage`) silinir; kesinleşmemiş veriyle
 * üretildiyse `provisionalPlayerPage`. Diğer slaytların alanları olduğu gibi korunur.
 */
export function withPlayerSlide(renderOptions: unknown, base: { url: string; label: string }, slide: { url: string; label: string }, provisional: boolean): Record<string, unknown> {
  const current = optionsOf(renderOptions);
  const carousel = carouselSchema.safeParse(current);
  const slides: SetSlide[] = carousel.success ? [...(current.carousel as SetSlide[])] : [{ ...base, page: "MATCH_RESULT" }];
  slides.splice(playerSlideIndex(current), 0, { ...slide, page: "PLAYER_STATS" });
  const pages = [...new Set<ContentTypeId>([...setPages("MATCH_RESULT", current), "PLAYER_STATS"])].sort(byOrder);
  const next: Record<string, unknown> = { ...current, carousel: slides, pages };
  delete next.pendingPlayerPage;
  if (provisional) next.provisionalPlayerPage = true;
  return next;
}

/**
 * Saf: set üretiminde sayfa numaraları — sabit sıradaki her sayfa bir numara alır; yeri ayrılan (bekleyen) oyuncu
 * sayfası da numarasını alır. `counts`: türün slayt sayısı (Maç Analizi 1 ya da 2), 0 = yok.
 */
export function setPageNumbers(counts: Partial<Record<ContentTypeId, number>>): Partial<Record<ContentTypeId, number[]>> {
  const numbers: Partial<Record<ContentTypeId, number[]>> = {};
  let next = 1;
  for (const page of SET_PAGE_ORDER) {
    const count = counts[page] ?? 0;
    if (count <= 0) continue;
    numbers[page] = Array.from({ length: count }, (_, index) => next + index);
    next += count;
  }
  return numbers;
}

/** "04" */
export const pageNumber = (value: number) => String(value).padStart(2, "0");

/** Maç Sonucu setinin "…de ekle" isteği (`set-extra-pages.ts`). */
export interface SetExtrasRequest {
  /** "Maç analizini de ekle": yüklenmiş analiz verisi. */
  analysis: MatchAnalysisFacts | null;
  /** "Tahmin karnesini de ekle" (formda yalnızca maçın sayılan kayıtları + sonuçları varsa açık). */
  scorecard: boolean;
}

/** Saf: "…de ekle" sayfa sayıları — analizin 02'si yalnızca devre verisi varsa. */
export function extraPageCounts(request: SetExtrasRequest): Partial<Record<ContentTypeId, number>> {
  return { MATCH_ANALYSIS: request.analysis ? (request.analysis.halves.available ? 2 : 1) : 0, PREDICTION_SCORECARD: request.scorecard ? 1 : 0 };
}
