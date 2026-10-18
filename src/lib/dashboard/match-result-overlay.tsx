import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import { BigScoreTemplate } from "@/skills/render-engine/templates/match-result/big-score";
import { FullFrameTemplate } from "@/skills/render-engine/templates/match-result/full-frame";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import { HeadlineTemplate } from "@/skills/render-engine/templates/match-result/headline";
import type { ResultTemplateProps } from "@/skills/render-engine/templates/match-result/shared";
import type { MatchResultCard, MatchResultTemplateId } from "@/types/match-result";

/**
 * Maç Sonucu gradyan + tipografi + marka katmanını şeffaf PNG olarak çizer (Satori). Fotoğrafa
 * metin yazdırılmaz; bu katman tonlanmış tam kadraj fotoğrafın üstüne basılır (CLAUDE.md 3.4).
 * `only` verilirse yalnızca o blok görünür çizilir — yerleşim çakışma kontrolü (`layout-check.ts`).
 */

export interface ResultOverlayOptions {
  template: MatchResultTemplateId;
  shadeStrength: number;
  /** 16:9 set sütununun tarafı (özne sağdaysa "left"); dikeyde yok sayılır. */
  side: ColumnSide;
  only?: BlockFilter;
}

const TEMPLATES: Record<MatchResultTemplateId, (props: ResultTemplateProps) => React.ReactElement> = {
  FULL_FRAME: FullFrameTemplate,
  BIG_SCORE: BigScoreTemplate,
  HEADLINE: HeadlineTemplate,
};

export async function renderMatchResultOverlay(card: MatchResultCard, frame: MatchDayFrame, options: ResultOverlayOptions): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const Template = TEMPLATES[options.template];
  const g = matchResultGeometry(frame, options.side, options.template);
  const response = new ImageResponse(<Template card={card} g={g} shadeStrength={options.shadeStrength} only={options.only} />, {
    width: frame.width,
    height: frame.height,
    fonts,
  });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}
