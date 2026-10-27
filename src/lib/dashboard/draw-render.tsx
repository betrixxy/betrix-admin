import sharp from "sharp";
import { drawPosterArt, listBackground, type PosterAdjust } from "@/lib/dashboard/draw-photo";
import { drawTextGate } from "@/lib/dashboard/draw-card";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { analysisArt } from "@/lib/dashboard/vitrin-photo";
import { renderSatori } from "@/skills/render-engine/satori-text";
import type { BlockFilter, LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { DrawTemplate } from "@/skills/render-engine/templates/draw/draw-card";
import { drawListGeometry, drawPosterGeometry, type DrawGeometry } from "@/skills/render-engine/templates/draw/geometry";
import type { DrawCard } from "@/types/draw";
import type { Result } from "@/types/result";

/**
 * Kura kartının çizimi — DB'siz (motor, görsel test, offline script). Sayfalar: A eleme → [poster];
 * A lig aşaması → [poster, rakip ızgarası]; B → [liste]; C → [liste]. Her sayfa: dil kapısı → yerleşim
 * kapısı (bloklar tek tek ölçülür) → zemin → yazı katmanı → gren/vinyet (aynı tohum).
 */

const POSTER_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "draw-kicker", "draw-hero", "draw-meta", "draw-fact", "footer-text", "footer-logo"];
const LIST_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "draw-hero", "draw-list", "footer-text", "footer-logo"];

export interface DrawPage {
  g: DrawGeometry;
  blocks: readonly LayoutBlockId[];
}

export function drawPages(card: DrawCard, frame: MatchDayFrame): DrawPage[] {
  const { kind } = card.body;
  if (kind === "TEAM_KNOCKOUT") return [{ g: drawPosterGeometry(frame, false), blocks: POSTER_BLOCKS }];
  if (kind === "TEAM_LEAGUE") return [{ g: drawPosterGeometry(frame, true), blocks: POSTER_BLOCKS }, { g: drawListGeometry(frame), blocks: LIST_BLOCKS }];
  return [{ g: drawListGeometry(frame), blocks: LIST_BLOCKS }];
}

export async function renderDrawLayer(card: DrawCard, g: DrawGeometry, page: number, only?: BlockFilter): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = renderSatori(<DrawTemplate card={card} g={g} page={page} only={only} />, { width: g.frame.width, height: g.frame.height, fonts });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

export interface DrawImageInput {
  card: DrawCard;
  frame: MatchDayFrame;
  /** A: takımın arşiv fotoğrafı (büyütülmüş sürüm); yoksa programatik zemin. */
  photo: UploadedImage | null;
  adjust?: PosterAdjust | undefined;
  seedKey: string;
}

export async function renderDrawImages(input: DrawImageInput): Promise<Result<Buffer[]>> {
  const language = drawTextGate(input.card);
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };
  const pages = drawPages(input.card, input.frame);
  for (const [index, page] of pages.entries()) {
    const gate = await layoutGate(`Kura sonucu sayfa ${index + 1}`, input.frame, (only) => renderDrawLayer(input.card, page.g, index, only), page.blocks);
    if (!gate.ok) return gate;
  }
  const out: Buffer[] = [];
  let posterArt: Buffer | null = null;
  for (const [index, page] of pages.entries()) {
    let art: Buffer;
    if (page.g.page === "poster") {
      const result = await drawPosterArt(input.photo, page.g, input.card.accentHex, input.adjust);
      if (!result.ok) return result;
      art = posterArt = result.data;
    } else {
      art = posterArt ? await analysisArt(posterArt, page.g.k) : await listBackground(input.frame, input.card.accentHex);
    }
    out.push(await finalizeSetImage(art, await renderDrawLayer(input.card, page.g, index), input.frame, input.seedKey));
  }
  return { ok: true, data: out };
}
