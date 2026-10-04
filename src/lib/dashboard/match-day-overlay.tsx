import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { MatchDayTemplateCard } from "@/skills/render-engine/templates/match-day-feed";
import type { MatchDayCard, MatchDayTemplateId } from "@/types/match-day";

/**
 * Seçili şablonun, seçili formattaki tipografi + logo + marka katmanını şeffaf PNG olarak çizer
 * (Satori). AI görseline asla metin yazdırılmaz; bu katman harmanlamadan sonra programatik olarak
 * basılır (bkz. CLAUDE.md 3.4). Çıktı sharp'tan geçirilir: her zaman standart, alfa kanallı PNG.
 */
export async function renderMatchDayOverlay(card: MatchDayCard, template: MatchDayTemplateId, frame: MatchDayFrame): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = new ImageResponse(<MatchDayTemplateCard card={card} template={template} frame={frame} />, {
    width: frame.width,
    height: frame.height,
    fonts,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return sharp(bytes).ensureAlpha().png().toBuffer();
}
