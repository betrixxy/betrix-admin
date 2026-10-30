import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { resolveSetImages } from "@/lib/dashboard/checkmatch-set";
import { buildMatchAnalysisCaption } from "@/lib/dashboard/match-analysis-caption";
import { buildHalvesCard, buildTimelineCard, HALVES_PAGE_LABEL, TIMELINE_PAGE_LABEL } from "@/lib/dashboard/match-analysis-card";
import { loadMatchAnalysisFacts, type AnalysisDeps } from "@/lib/dashboard/match-analysis-data";
import { renderHalvesImage, renderTimelineImage } from "@/lib/dashboard/match-analysis-render";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { PLAYER_STATS_FORMATS } from "@/lib/dashboard/player-stats-engine";
import { teamRef } from "@/lib/dashboard/set-people";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { withTeamOrigins } from "@/lib/dashboard/team-origin";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { teamPeople } from "@/lib/names/person-directory";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchAnalysisFacts } from "@/types/match-analysis";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PostMatchCardResult, PostMatchSlide } from "@/types/post-match-cards";
import type { Result } from "@/types/result";

/**
 * Maç Analizi üretimi (kural tabanlı, yapay zekâ ve Fal YOK) → DRAFT `AiContent` (`MATCH_ANALYSIS`). 01 zaman
 * çizelgesi her zaman; 02 devre devre yalnızca devre verisi varsa (yoksa 01 tek başına, sebep notlarda). Gönderi
 * metni şablondan (`buildMatchAnalysisCaption`), kart + gönderi metni bahis dili kapısından (`contentLanguageGate`).
 * Maç Sonucu carousel'i aynı sayfa çizicisini (`renderAnalysisPages`) 01'in bulanık zeminiyle kullanır.
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

/** Üretim bağımlılıkları: arşiv düzeltmeli kişi adları + takım kökeni (yalnızca okuma). */
export const PRODUCTION_ANALYSIS_DEPS: AnalysisDeps = {
  teamPeople: (team, ids) => teamPeople(teamRef(team), ids),
  withOrigins: (match) => withTeamOrigins(match),
};

export function loadStudioAnalysisFacts(raw: ApiFootballFixtureResultRaw): Promise<MatchAnalysisFacts | null> {
  return loadMatchAnalysisFacts(raw, PRODUCTION_ANALYSIS_DEPS);
}

const sentence = (label: string) => {
  const [number, name = ""] = label.split(" · ");
  return `${number} · ${name.charAt(0)}${name.slice(1).toLocaleLowerCase("tr-TR")}`;
};

export interface AnalysisPagesInput {
  facts: MatchAnalysisFacts;
  format: MatchDayFormatId;
  /** Carousel'de 01 Maç Sonucu nihai görseli (bulanık zemin); tek başına null (programatik zemin). */
  resultImage: Buffer | null;
  /** Sayfa etiketleri — tek başına "01 · ZAMAN ÇİZELGESİ" / "02 · DEVRE DEVRE", sette sıradaki numara. */
  labels?: { timeline: string; halves: string };
}

export interface AnalysisPages {
  pages: { image: Buffer; label: string }[];
  notes: string[];
}

/** 01 (+ 02) çizimi — her sayfa kendi bahis dili + yerleşim kapısından geçer. */
export async function renderAnalysisPages(input: AnalysisPagesInput): Promise<Result<AnalysisPages, EngineError>> {
  const { facts } = input;
  const frame = MATCH_DAY_FRAMES[input.format];
  const labels = input.labels ?? { timeline: TIMELINE_PAGE_LABEL, halves: HALVES_PAGE_LABEL };
  const set = await resolveSetImages(facts.match);
  const images = { homeLogo: set.homeLogo, awayLogo: set.awayLogo, brandLogo: set.brandLogo };
  reportJobStep("Maç Analizi çiziliyor (zaman çizelgesi)");
  const timeline = await renderTimelineImage({ card: buildTimelineCard(facts, frame, images, labels.timeline), frame, resultImage: input.resultImage, seedKey: facts.match.fixtureId });
  if (!timeline.ok) return timeline;
  const pages = [{ image: timeline.data, label: sentence(labels.timeline) }];
  const notes = [...facts.warnings];
  if (facts.halves.available) {
    reportJobStep("Maç Analizi çiziliyor (devre devre)");
    const halves = await renderHalvesImage({ card: buildHalvesCard(facts, facts.halves.stats, images, labels.halves), frame, resultImage: input.resultImage, seedKey: facts.match.fixtureId });
    if (!halves.ok) return halves;
    pages.push({ image: halves.data, label: sentence(labels.halves) });
  } else {
    notes.push(`Devre devre sayfası düştü: ${facts.halves.reason}`);
  }
  return { ok: true, data: { pages, notes } };
}

export async function createMatchAnalysisDraft(input: { facts: MatchAnalysisFacts; format: MatchDayFormatId }): Promise<Result<PostMatchCardResult, EngineError>> {
  const { facts } = input;
  const rendered = await renderAnalysisPages({ facts, format: input.format, resultImage: null });
  if (!rendered.ok) return rendered;
  const caption = buildMatchAnalysisCaption(facts);
  const language = contentLanguageGate({ caption });
  if (language) return fail(BANNED_LANGUAGE, `${language} — kart üretilmedi.`);

  reportJobStep("Kaydediliyor");
  try {
    const urls = await Promise.all(rendered.data.pages.map((page) => saveStoredFile("renders", `${randomUUID()}.png`, page.image)));
    const slides: PostMatchSlide[] = rendered.data.pages.map((page, index) => ({ url: urls[index] ?? "", label: page.label }));
    const imageUrl = urls[0] ?? "";
    const format = PLAYER_STATS_FORMATS[input.format];
    const record = await createScheduledContent({
      fixtureId: toFixtureId(facts.match.fixtureId),
      contentType: "MATCH_ANALYSIS" satisfies ContentTypeId,
      prompt: "",
      backgroundImageUrl: null,
      resultImageUrl: imageUrl,
      playerImageUrl: null,
      status: "DRAFT",
      format: format.db,
      caption,
      statsSnapshot: asJson(facts),
      renderOptions: asJson({
        kind: "MATCH_ANALYSIS",
        format: format.social,
        frameFormat: input.format,
        imageUrl,
        title: `Maç Analizi · ${matchResultTitle(facts.match)}`,
        subtitle: `${facts.match.competition.name} · ${facts.match.roundLabel}`,
        halves: facts.halves.available ? facts.halves.stats.source : null,
        halvesDropped: facts.halves.available ? null : facts.halves.reason,
        // Yayın Merkezi bu sırayla dizer; 02 düştüyse tek kart.
        ...(slides.length > 1 ? { carousel: slides } : {}),
      }),
    });
    return { ok: true, data: { id: record.id, format: input.format, slides, notes: rendered.data.notes } };
  } catch (error: unknown) {
    console.error("[match-analysis] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Maç Analizi kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
