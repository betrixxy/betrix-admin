import { renderSatori } from "@/skills/render-engine/satori-text";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { MatchDayTemplateCard } from "@/skills/render-engine/templates/match-day-feed";
import type { MatchDayCard, MatchDayTemplateId } from "@/types/match-day";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { layoutGate, type LayoutReport } from "@/lib/dashboard/layout-check";
import { MATCH_DAY_NAME_LAYERS } from "@/skills/render-engine/templates/checkmatch-set/blocks";
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

/**
 * Maç Günü yerleşim kapısı: DATA_DRIVEN'da alt alta ad satırları (kırılan uzun ad dahil) — komşu satırların
 * Ç/Ş/Ğ kuyruğu ile İ/Ö/Ü işareti piksel düzeyinde denetlenir. Diğer şablonlarda kapı yok (geçer).
 */
export async function matchDayLayoutGate(card: MatchDayCard, template: MatchDayTemplateId, frame: MatchDayFrame): Promise<Result<LayoutReport | null>> {
  if (template !== "DATA_DRIVEN") return { ok: true, data: null };
  return layoutGate("Maç Günü ad satırları", frame, (only) => renderMatchDayOverlay(card, template, frame, only), MATCH_DAY_NAME_LAYERS);
}
