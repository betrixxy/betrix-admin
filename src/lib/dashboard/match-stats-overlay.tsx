import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { matchStatsGeometry } from "@/skills/render-engine/templates/match-stats/geometry";
import { MatchStatsTemplate } from "@/skills/render-engine/templates/match-stats/stats-card";
import type { MatchStatsCard } from "@/types/match-stats";

/** Maç İstatistikleri tipografi + çubuk + marka katmanını şeffaf PNG olarak çizer (Satori, CLAUDE.md 3.4). */
export async function renderMatchStatsOverlay(card: MatchStatsCard, frame: MatchDayFrame): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = new ImageResponse(<MatchStatsTemplate card={card} g={matchStatsGeometry(frame)} />, {
    width: frame.width,
    height: frame.height,
    fonts,
  });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}
