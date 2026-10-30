import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { buildStatsBackground, buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { renderSatori } from "@/skills/render-engine/satori-text";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { HalvesTemplate } from "@/skills/render-engine/templates/match-analysis/halves";
import { ANALYSIS_BLOCKS } from "@/skills/render-engine/templates/match-analysis/parts";
import { TimelineTemplate } from "@/skills/render-engine/templates/match-analysis/timeline";
import type { AnalysisCardBase, HalvesCard, TimelineCard } from "@/types/match-analysis";
import type { Result } from "@/types/result";

/**
 * Maç Analizi görsellerinin çizimi — DB'siz (ileride motor, Maç Sonucu carousel'i; şimdi görsel test ve offline
 * araç ortak kullanır). Her sayfada önce BAHİS DİLİ kapısı (kartın bütün metinleri, ortak tek kapı), sonra
 * YERLEŞİM KAPISI (bloklar birbiriyle ya da güvenli kenarla çakışmaz, her öğe bir bloğa aittir; satırlar mürekkep
 * katmanında piksel düzeyinde) — bulgu varsa görsel üretilmez, sebep yazılır. Zemin: carousel'de 01 Maç
 * Sonucu'nun bulanık hâli, tek başına programatik koyu zemin (iki takım renginde ışık). Set bitişi (vinyet +
 * maç kimliği tohumlu gren) set kartlarıyla aynı (`finalizeSetImage`).
 */

type RenderError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: RenderError } => ({ ok: false, error: { code, message } });

async function png(element: React.ReactElement, frame: MatchDayFrame): Promise<Buffer> {
  const response = renderSatori(element, { width: frame.width, height: frame.height, fonts: await loadMatchDayFonts() });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

export function renderTimelineOverlay(card: TimelineCard, frame: MatchDayFrame, only?: BlockFilter): Promise<Buffer> {
  return png(<TimelineTemplate card={card} frame={frame} only={only} />, frame);
}

export function renderHalvesOverlay(card: HalvesCard, frame: MatchDayFrame, only?: BlockFilter): Promise<Buffer> {
  return png(<HalvesTemplate card={card} frame={frame} only={only} />, frame);
}

export interface AnalysisImageInput<C extends AnalysisCardBase> {
  card: C;
  frame: MatchDayFrame;
  /** Carousel'de 01 Maç Sonucu nihai görseli (bulanık zemin); yoksa programatik zemin. */
  resultImage: Buffer | null;
  /** Gren tohumu — maç kimliği (aynı maçın kartları aynı greni alır). */
  seedKey: string | number;
}

async function renderPage<C extends AnalysisCardBase>(label: string, input: AnalysisImageInput<C>, overlay: (only?: BlockFilter) => Promise<Buffer>): Promise<Result<Buffer, RenderError>> {
  const { card, frame } = input;
  const language = contentLanguageGate({ card });
  if (language) return fail(BANNED_LANGUAGE, `${language} — kart üretilmedi.`);
  try {
    const gate = await layoutGate(label, frame, (only) => overlay(only), ANALYSIS_BLOCKS);
    if (!gate.ok) return fail(gate.error.code, gate.error.message);
    const background = input.resultImage ? await buildStatsBackgroundFromResult(frame, input.resultImage) : await buildStatsBackground(frame, card.homeHex, card.awayHex, null);
    return { ok: true, data: await finalizeSetImage(background, await overlay(), frame, input.seedKey) };
  } catch (error: unknown) {
    console.error(`[match-analysis] ${label} ${frame.id} çizilemedi:`, error);
    return fail("RENDER_FAILED", `${label} çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function renderTimelineImage(input: AnalysisImageInput<TimelineCard>): Promise<Result<Buffer, RenderError>> {
  return renderPage("Maç Analizi 01 · Zaman çizelgesi", input, (only) => renderTimelineOverlay(input.card, input.frame, only));
}

export function renderHalvesImage(input: AnalysisImageInput<HalvesCard>): Promise<Result<Buffer, RenderError>> {
  return renderPage("Maç Analizi 02 · Devre devre", input, (only) => renderHalvesOverlay(input.card, input.frame, only));
}
