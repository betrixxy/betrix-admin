import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { h2hTextGate } from "@/lib/dashboard/player-h2h-card";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { analysisArt, preparePosterArt, type VitrinPhotos } from "@/lib/dashboard/vitrin-photo";
import { renderSatori } from "@/skills/render-engine/satori-text";
import type { BlockFilter, LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { h2hCompareGeometry, h2hPosterGeometry, type H2HGeometry } from "@/skills/render-engine/templates/player-h2h/geometry";
import { H2HTemplate } from "@/skills/render-engine/templates/player-h2h/h2h-card";
import type { H2HCard } from "@/types/player-h2h";
import type { Result } from "@/types/result";

/**
 * Oyuncu karşılaştırma carousel'inin çizimi — DB'siz (motor, önizleme, görsel test, offline script).
 * Sıra (vitrinle aynı): dil kapısı → iki sayfanın yerleşim kapısı → poster sanatı (iki fotoğraf çapraz,
 * takım renginde ışık; vitrin hattı) → karşılaştırma zemini (posterin bulanık/koyu hâli) → yazı
 * katmanları → gren/vinyet (iki sayfa aynı tohum). Kapılardan biri geçmezse kart üretilmez.
 */

export const H2H_POSTER_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "players", "hero", "fact", "footer-text", "footer-logo"];
export const H2H_COMPARE_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "faces", "chart", "footnote", "footer-text", "footer-logo"];

export function h2hGeometries(frame: MatchDayFrame) {
  return { poster: h2hPosterGeometry(frame), compare: h2hCompareGeometry(frame) };
}

export async function renderH2HLayer(card: H2HCard, g: H2HGeometry, only?: BlockFilter): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = renderSatori(<H2HTemplate card={card} g={g} only={only} />, { width: g.frame.width, height: g.frame.height, fonts });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

export interface H2HImageInput {
  card: H2HCard;
  frame: MatchDayFrame;
  /** Sol oyuncu `home`, sağ oyuncu `away` yarısında (arşivin büyütülmüş sürümü); yoksa programatik yarı. */
  photos: VitrinPhotos;
  seedKey: string;
  upscale?: PhotoUpscaler | undefined;
}

/** [01 Poster, 02 İstatistikler] PNG'leri. */
export async function renderH2HImages(input: H2HImageInput): Promise<Result<[Buffer, Buffer]>> {
  const language = h2hTextGate(input.card);
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };
  const { poster, compare } = h2hGeometries(input.frame);
  const posterGate = await layoutGate("Oyuncu karşılaştırması 01 Poster", input.frame, (only) => renderH2HLayer(input.card, poster, only), H2H_POSTER_BLOCKS);
  if (!posterGate.ok) return posterGate;
  const compareGate = await layoutGate("Oyuncu karşılaştırması 02 İstatistikler", input.frame, (only) => renderH2HLayer(input.card, compare, only), H2H_COMPARE_BLOCKS);
  if (!compareGate.ok) return compareGate;
  const art = await preparePosterArt({ photos: input.photos, g: poster, homeHex: input.card.left.hex, awayHex: input.card.right.hex, upscale: input.upscale });
  if (!art.ok) return art;
  const [posterOverlay, compareOverlay, compareBase] = await Promise.all([renderH2HLayer(input.card, poster), renderH2HLayer(input.card, compare), analysisArt(art.data, compare.k)]);
  const pages = await Promise.all([finalizeSetImage(art.data, posterOverlay, input.frame, input.seedKey), finalizeSetImage(compareBase, compareOverlay, input.frame, input.seedKey)]);
  return { ok: true, data: pages };
}
