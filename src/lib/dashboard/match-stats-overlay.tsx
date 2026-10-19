import { renderSatori } from "@/skills/render-engine/satori-text";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import { matchStatsGeometry } from "@/skills/render-engine/templates/match-stats/geometry";
import { MatchStatsTemplate } from "@/skills/render-engine/templates/match-stats/stats-card";
import type { MatchStatsCard } from "@/types/match-stats";

export interface StatsOverlayOptions {
  /** 16:9 set sütununun tarafı — 01 ile aynı olmalı (carousel tutarlılığı). */
  side?: ColumnSide;
  /** Yerleşim kontrolü: yalnızca bu blok görünür (bkz. `layout-check.ts`). */
  only?: BlockFilter;
}

/** Maç İstatistikleri tipografi + çubuk + marka katmanını şeffaf PNG olarak çizer (Satori, CLAUDE.md 3.4). */
export async function renderMatchStatsOverlay(card: MatchStatsCard, frame: MatchDayFrame, options: StatsOverlayOptions = {}): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = renderSatori(<MatchStatsTemplate card={card} g={matchStatsGeometry(frame, options.side ?? "right")} only={options.only} />, {
    width: frame.width,
    height: frame.height,
    fonts,
  });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}
