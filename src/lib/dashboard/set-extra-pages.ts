import { HALVES_PAGE_LABEL, TIMELINE_PAGE_LABEL } from "@/lib/dashboard/match-analysis-card";
import { renderAnalysisPages } from "@/lib/dashboard/match-analysis-engine";
import { MATCH_KICKER } from "@/lib/dashboard/prediction-scorecard-card";
import { renderMatchScorecardPage } from "@/lib/dashboard/prediction-scorecard-engine";
import { extraPageCounts, pageNumber, setPageNumbers, type SetExtrasRequest } from "@/lib/dashboard/set-pages";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId } from "@/types/match-day";
import type { Result } from "@/types/result";

/**
 * Maç Sonucu setinin "…de ekle" sayfaları (kurucu kararı 2026-10-30): Maç Analizi (01 zaman çizelgesi + 02 devre
 * devre; devre verisi yoksa yalnızca zaman çizelgesi, sebep notlarda) ve Tahmin Karnesi (A, maç). SABİT sırada,
 * 02/03'ten sonra (`set-pages.ts::SET_PAGE_ORDER`); aynı format, zemin 01'in bulanık hâli, vurgu set kuralından
 * (`resultAccentHex`). Bu iki şablonda yan set sütunu yoktur (16:9 yatay eksen / ortalı karne) — sütun tarafı uygulanmaz.
 * Her sayfa kendi bahis dili + yerleşim kapısından geçer; biri düşerse set üretilmez (sebep yazılır).
 */

type ExtraError = { code: string; message: string };

export type { SetExtrasRequest };

export interface SetExtraSlide {
  image: Buffer;
  /** "04 · Zaman çizelgesi" */
  label: string;
  page: ContentTypeId;
}

const relabel = (label: string, number: number) => `${pageNumber(number)} · ${label.split(" · ").slice(1).join(" · ")}`;

export async function renderSetExtras(input: {
  fixtureId: number;
  format: MatchDayFormatId;
  resultImage: Buffer;
  request: SetExtrasRequest;
  /** Önceki sayfaların sayısı (01 + 02 + oyuncu sayfası — ayrılmış olanı da). */
  counts: Partial<Record<ContentTypeId, number>>;
}): Promise<Result<{ slides: SetExtraSlide[]; notes: string[] }, ExtraError>> {
  const numbers = setPageNumbers({ ...input.counts, ...extraPageCounts(input.request) });
  const slides: SetExtraSlide[] = [];
  const notes: string[] = [];
  const { analysis } = input.request;
  const [timelineNo, halvesNo] = numbers.MATCH_ANALYSIS ?? [];
  if (analysis && timelineNo) {
    const labels = { timeline: relabel(TIMELINE_PAGE_LABEL, timelineNo), halves: relabel(HALVES_PAGE_LABEL, halvesNo ?? timelineNo + 1) };
    const rendered = await renderAnalysisPages({ facts: analysis, format: input.format, resultImage: input.resultImage, labels });
    if (!rendered.ok) return rendered;
    slides.push(...rendered.data.pages.map((page) => ({ ...page, page: "MATCH_ANALYSIS" as const })));
    notes.push(...rendered.data.notes.map((note) => `Maç Analizi: ${note}`));
  }
  const scorecardNo = numbers.PREDICTION_SCORECARD?.[0];
  if (input.request.scorecard && scorecardNo) {
    const kicker = `${pageNumber(scorecardNo)} · ${MATCH_KICKER}`;
    const rendered = await renderMatchScorecardPage({ fixtureId: toFixtureId(input.fixtureId), format: input.format, resultImage: input.resultImage, kicker });
    if (!rendered.ok) return rendered;
    slides.push({ image: rendered.data.image, label: `${pageNumber(scorecardNo)} · Tahmin karnesi`, page: "PREDICTION_SCORECARD" });
    if (rendered.data.data.duplicates > 0) notes.push(`Tahmin Karnesi: ${rendered.data.data.duplicates} tekrar onay sayılmadı (yalnızca ilk onay).`);
  }
  return { ok: true, data: { slides, notes } };
}
