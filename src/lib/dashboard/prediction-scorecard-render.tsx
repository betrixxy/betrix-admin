import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { buildStatsBackground, buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { renderSatori } from "@/skills/render-engine/satori-text";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { scorecardGeometry } from "@/skills/render-engine/templates/prediction-scorecard/geometry";
import { MatchScorecardTemplate } from "@/skills/render-engine/templates/prediction-scorecard/match-card";
import { PeriodScorecardTemplate } from "@/skills/render-engine/templates/prediction-scorecard/period-card";
import type { ScorecardCard } from "@/types/prediction-scorecard-card";
import type { Result } from "@/types/result";

/**
 * Tahmin Karnesi çizimi — DB'siz (ileride motor, Maç Sonucu carousel'i, görsel test ve offline script ortak
 * kullanır). Sıra: bahis dili kapısı (kartın BÜTÜN metinleri, ortak tek kapı) → YERLEŞİM KAPISI (her öğe bir
 * bloğa ait, blok çakışması / güvenli kenar taşması / alt alta satır mürekkep teması yok) → koyu set zemini
 * (carousel'de 01'in bulanık hâli, tek başına programatik) → set bitişi (vinyet + tohumlu gren).
 */

type RenderError = { code: string; message: string };

export function renderScorecardOverlay(card: ScorecardCard, frame: MatchDayFrame, options: { only?: BlockFilter } = {}): Promise<Buffer> {
  const g = scorecardGeometry(frame, card);
  const element = card.kind === "MATCH" ? <MatchScorecardTemplate card={card} g={g} only={options.only} /> : <PeriodScorecardTemplate card={card} g={g} only={options.only} />;
  return png(element, frame);
}

async function png(element: React.ReactElement, frame: MatchDayFrame): Promise<Buffer> {
  const response = renderSatori(element, { width: frame.width, height: frame.height, fonts: await loadMatchDayFonts() });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

export interface ScorecardImageInput {
  card: ScorecardCard;
  frame: MatchDayFrame;
  /** Carousel'de 01 Maç Sonucu nihai görseli (bulanık zemin); yoksa programatik koyu zemin. */
  resultImage: Buffer | null;
  seedKey: string | number;
}

export async function renderScorecardImage(input: ScorecardImageInput): Promise<Result<Buffer, RenderError>> {
  const { card, frame } = input;
  const language = contentLanguageGate({ card });
  if (language) return { ok: false, error: { code: BANNED_LANGUAGE, message: `${language} — kart üretilmedi.` } };
  try {
    const gate = await layoutGate("Tahmin Karnesi", frame, (only) => renderScorecardOverlay(card, frame, { only }));
    if (!gate.ok) return { ok: false, error: gate.error };
    const background = input.resultImage ? await buildStatsBackgroundFromResult(frame, input.resultImage) : await buildStatsBackground(frame, card.glowHexes[0], card.glowHexes[1], null);
    return { ok: true, data: await finalizeSetImage(background, await renderScorecardOverlay(card, frame), frame, input.seedKey) };
  } catch (error: unknown) {
    console.error(`[karne] ${card.kind} ${frame.id} çizilemedi:`, error);
    return { ok: false, error: { code: "RENDER_FAILED", message: `Tahmin Karnesi çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}` } };
  }
}
