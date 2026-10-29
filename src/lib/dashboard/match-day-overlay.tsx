import { renderSatori } from "@/skills/render-engine/satori-text";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { MatchDayTemplateCard } from "@/skills/render-engine/templates/match-day-feed";
import type { MatchDayCard, MatchDayTemplateId } from "@/types/match-day";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { bandSafeArea, layoutGate, type LayoutReport } from "@/lib/dashboard/layout-check";
import type { LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { DATA_DRIVEN_BLOCKS } from "@/skills/render-engine/templates/match-day/data-driven";
import { EDITORIAL_PORTRAIT_BLOCKS } from "@/skills/render-engine/templates/match-day/editorial-portrait";
import { PREMIUM_BROADCAST_BLOCKS } from "@/skills/render-engine/templates/match-day/premium-broadcast";
import type { Result } from "@/types/result";

/**
 * Seçili şablonun, seçili formattaki tipografi + logo + marka katmanını şeffaf PNG olarak çizer
 * (Satori). AI görseline asla metin yazdırılmaz; bu katman harmanlamadan sonra programatik olarak
 * basılır (bkz. CLAUDE.md 3.4). Çıktı sharp'tan geçirilir: her zaman standart, alfa kanallı PNG.
 */
export async function renderMatchDayOverlay(card: MatchDayCard, template: MatchDayTemplateId, frame: MatchDayFrame, only?: BlockFilter): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = renderSatori(<MatchDayTemplateCard card={card} template={template} frame={frame} only={only} />, {
    width: frame.width,
    height: frame.height,
    fonts,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return sharp(bytes).ensureAlpha().png().toBuffer();
}

/** Şablon başına ölçülen bloklar — logo dahil kartın HER öğesi (sonda bloksuz öğe kalmadığını da denetler). */
export const MATCH_DAY_TEMPLATE_BLOCKS: Record<MatchDayTemplateId, readonly LayoutBlockId[]> = {
  DATA_DRIVEN: DATA_DRIVEN_BLOCKS,
  PREMIUM_BROADCAST: PREMIUM_BROADCAST_BLOCKS,
  EDITORIAL_PORTRAIT: EDITORIAL_PORTRAIT_BLOCKS,
};

/**
 * Maç Günü yerleşim kapısı — her şablonda bütün bloklar (künye, başlık, tarih, form, istatistik kutuları,
 * CheckMatch logosu) birbiriyle ve güvenli alanla çakışmamalı; DATA_DRIVEN ad satırları ayrıca piksel
 * düzeyinde (Ç/Ş/Ğ kuyruğu, İ/Ö/Ü işareti). Güvenli alan: platform bantları + 24px (şablon kenarı 48–56px).
 */
export async function matchDayLayoutGate(card: MatchDayCard, template: MatchDayTemplateId, frame: MatchDayFrame): Promise<Result<LayoutReport>> {
  return layoutGate("Maç Günü", frame, (only) => renderMatchDayOverlay(card, template, frame, only), MATCH_DAY_TEMPLATE_BLOCKS[template], bandSafeArea(frame));
}
