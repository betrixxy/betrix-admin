import { ImageResponse } from "next/og";
import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { vitrinTextGate } from "@/lib/dashboard/vitrin-card";
import { analysisArt, preparePosterArt, type VitrinPhotos } from "@/lib/dashboard/vitrin-photo";
import type { BlockFilter, LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { analysisGeometry, posterGeometry, type VitrinGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import { VitrinTemplate } from "@/skills/render-engine/templates/vitrin/vitrin-card";
import type { Result } from "@/types/result";
import type { VitrinCard } from "@/types/vitrin";

/**
 * Vitrin carousel'inin çizimi — DB'siz (motor, önizleme, görsel test ve offline script ortak). Sıra:
 * dil kapısı → iki sayfanın yerleşim kapısı (bloklar tek tek ölçülür) → poster sanatı (iki fotoğraf,
 * çapraz) → analiz zemini (posterin bulanık/koyu hâli) → yazı katmanları → gren/vinyet
 * (`finalizeSetImage`, iki sayfa aynı tohum). Kapılardan biri geçmezse carousel üretilmez, sebep yazılır.
 */

export const POSTER_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "teams", "win-bar", "headline", "footer-text", "footer-logo"];
export const ANALYSIS_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "form", "open-2", "open-1", "locked", "hook", "footer-text", "footer-logo"];

export function vitrinGeometries(frame: MatchDayFrame) {
  return { poster: posterGeometry(frame), analysis: analysisGeometry(frame) };
}

export async function renderVitrinLayer(card: VitrinCard, g: VitrinGeometry, only?: BlockFilter): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = new ImageResponse(<VitrinTemplate card={card} g={g} only={only} />, { width: g.frame.width, height: g.frame.height, fonts });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

export interface VitrinImageInput {
  card: VitrinCard;
  frame: MatchDayFrame;
  /** İki takımın kart için hazırlanmış fotoğrafı (arşivin büyütülmüş sürümü); yoksa programatik yarı. */
  photos: VitrinPhotos;
  /** Gren tohumu — aynı maç aynı greni alır. */
  seedKey: string;
  upscale?: PhotoUpscaler | undefined;
}

/** [01 Poster, 02 Analiz] PNG'leri. */
export async function renderVitrinImages(input: VitrinImageInput): Promise<Result<[Buffer, Buffer]>> {
  const language = vitrinTextGate(input.card);
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };
  const { poster, analysis } = vitrinGeometries(input.frame);
  const posterGate = await layoutGate("Vitrin 01 Poster", input.frame, (only) => renderVitrinLayer(input.card, poster, only), POSTER_BLOCKS);
  if (!posterGate.ok) return posterGate;
  const analysisGate = await layoutGate("Vitrin 02 Analiz", input.frame, (only) => renderVitrinLayer(input.card, analysis, only), ANALYSIS_BLOCKS);
  if (!analysisGate.ok) return analysisGate;
  const art = await preparePosterArt({ photos: input.photos, g: poster, homeHex: input.card.homeHex, awayHex: input.card.awayHex, upscale: input.upscale });
  if (!art.ok) return art;
  const [posterOverlay, analysisOverlay, analysisBase] = await Promise.all([renderVitrinLayer(input.card, poster), renderVitrinLayer(input.card, analysis), analysisArt(art.data, analysis.k)]);
  const pages = await Promise.all([finalizeSetImage(art.data, posterOverlay, input.frame, input.seedKey), finalizeSetImage(analysisBase, analysisOverlay, input.frame, input.seedKey)]);
  return { ok: true, data: pages };
}
