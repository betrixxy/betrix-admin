import type { SetImages } from "@/lib/dashboard/checkmatch-set";
import { layoutGate } from "@/lib/dashboard/layout-check";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { buildStatsBackground, buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { buildMatchStatsCard, resolveMatchStatsImages } from "@/lib/dashboard/match-stats-card";
import { renderMatchStatsOverlay } from "@/lib/dashboard/match-stats-overlay";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import type { MatchStatsFacts, MatchStatsPage } from "@/types/match-stats";
import type { Result } from "@/types/result";

/**
 * Maç İstatistikleri (02) görselinin çizimi — DB'siz (motor, Maç Sonucu carousel'i, görsel test ve
 * offline script ortak kullanır). Zemin 01 Maç Sonucu nihai görselinin bulanık/koyu hâli, yoksa
 * programatik. YERLEŞİM KAPISI: çakışma ya da güvenli kenar taşması varsa görsel üretilmez.
 */

type RenderError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: RenderError } => ({ ok: false, error: { code, message } });

export interface StatsImageInput {
  stats: MatchStatsFacts;
  frame: MatchDayFrame;
  page: MatchStatsPage;
  side: ColumnSide;
  /** 01 Maç Sonucu nihai görseli; yoksa programatik zemin. */
  resultImage: Buffer | null;
  /** Carousel'de "02 · İSTATİSTİKLER"; tek başına paylaşımda null. */
  pageLabel: string | null;
  /** Önceden çözülmüş logolar (test/offline: ağsız); verilmezse maçtan çözülür. */
  images?: SetImages | undefined;
}

/** 02 görselini çizer (yerleşim kapısı dahil) — Maç Sonucu carousel'i de bunu kullanır. */
export async function renderMatchStatsImage(input: StatsImageInput): Promise<Result<Buffer, RenderError>> {
  const { stats, frame, side } = input;
  const card = buildMatchStatsCard(stats, input.page, input.images ?? (await resolveMatchStatsImages(stats)), input.pageLabel);
  try {
    const gate = await layoutGate("Maç İstatistikleri", frame, (only) => renderMatchStatsOverlay(card, frame, { side, only }));
    if (!gate.ok) return fail(gate.error.code, gate.error.message);
    const background = input.resultImage ? await buildStatsBackgroundFromResult(frame, input.resultImage) : await buildStatsBackground(frame, card.homeHex, card.awayHex, null);
    return { ok: true, data: await finalizeSetImage(background, await renderMatchStatsOverlay(card, frame, { side }), frame, stats.fixtureId) };
  } catch (error: unknown) {
    console.error(`[match-stats] ${frame.id} çizilemedi:`, error);
    return fail("RENDER_FAILED", `İstatistik kartı çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}`);
  }
}
