import { renderSatori } from "@/skills/render-engine/satori-text";
import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { vitrinTextGate } from "@/lib/dashboard/vitrin-card";
import { droppedPageNote } from "@/lib/dashboard/set-pages";
import { analysisArt, preparePosterArt, type PosterTeams, type VitrinPhotos } from "@/lib/dashboard/vitrin-photo";
import type { BlockFilter, LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { analysisGeometry, posterGeometry, type VitrinGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import { VitrinTemplate } from "@/skills/render-engine/templates/vitrin/vitrin-card";
import type { Result } from "@/types/result";
import type { VitrinCard } from "@/types/vitrin";

/**
 * Vitrin carousel'inin çizimi — DB'siz (motor, önizleme, görsel test ve offline script ortak). Sıra:
 * dil kapısı → iki sayfanın yerleşim kapısı (bloklar tek tek ölçülür) → poster sanatı (iki fotoğraf,
 * çapraz) → analiz zemini (posterin bulanık/koyu hâli) → yazı katmanları → gren/vinyet
 * (`finalizeSetImage`, iki sayfa aynı tohum). 01 Poster kapıdan geçmezse carousel üretilmez, sebep yazılır.
 * 02 Analiz kapıya takılırsa (canlı test 2026-10-31: uzun takım adı kutuyu taşırdı) 01 DÜŞMEZ — Vitrin iki sayfalık
 * bir üründür ama poster (kazanma çubuğu + manşet) tek başına yayınlanabilir: `renderVitrinPages` 01'i tek sayfa
 * döner, sebep notta; stüdyo ve taslak ekranı notu gösterir. Katı sürüm (`renderVitrinImages`) görsel test/araç içindir.
 */

export const POSTER_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "teams", "win-bar", "headline", "footer-text", "footer-logo"];
export const ANALYSIS_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "form", "stack-a", "stack-b", "open-2", "open-1", "locked", "hook", "footer-text", "footer-logo"];

/** Fotoğrafsız yarının yedek tasarımı için takımlar (ad, renk, logo) — kartın kendisinden. */
export function posterTeams(card: VitrinCard): PosterTeams {
  return {
    home: { name: card.names.home, hex: card.homeHex, logo: card.homeLogo },
    away: { name: card.names.away, hex: card.awayHex, logo: card.awayLogo },
  };
}

export function vitrinGeometries(frame: MatchDayFrame) {
  return { poster: posterGeometry(frame), analysis: analysisGeometry(frame) };
}

export async function renderVitrinLayer(card: VitrinCard, g: VitrinGeometry, only?: BlockFilter): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = renderSatori(<VitrinTemplate card={card} g={g} only={only} />, { width: g.frame.width, height: g.frame.height, fonts });
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

/** 01 Poster (+ kapıdan geçerse 02 Analiz) PNG'leri; düşen 02'nin sebebi `notes`'ta. */
export async function renderVitrinPages(input: VitrinImageInput): Promise<Result<{ pages: Buffer[]; notes: string[] }>> {
  const language = vitrinTextGate(input.card);
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };
  const { poster, analysis } = vitrinGeometries(input.frame);
  const posterGate = await layoutGate("Vitrin 01 Poster", input.frame, (only) => renderVitrinLayer(input.card, poster, only), POSTER_BLOCKS);
  if (!posterGate.ok) return posterGate;
  const analysisGate = await layoutGate("Vitrin 02 Analiz", input.frame, (only) => renderVitrinLayer(input.card, analysis, only), ANALYSIS_BLOCKS);
  const art = await preparePosterArt({ photos: input.photos, g: poster, homeHex: input.card.homeHex, awayHex: input.card.awayHex, upscale: input.upscale, teams: posterTeams(input.card) });
  if (!art.ok) return art;
  const posterPage = finalizeSetImage(art.data, await renderVitrinLayer(input.card, poster), input.frame, input.seedKey);
  if (!analysisGate.ok) return { ok: true, data: { pages: [await posterPage], notes: [droppedPageNote("02 · Analiz", analysisGate.error.message)] } };
  const [analysisOverlay, analysisBase] = await Promise.all([renderVitrinLayer(input.card, analysis), analysisArt(art.data, analysis.k)]);
  const pages = await Promise.all([posterPage, finalizeSetImage(analysisBase, analysisOverlay, input.frame, input.seedKey)]);
  return { ok: true, data: { pages, notes: [] } };
}

/** Katı sürüm: iki sayfa da üretilmeli (görsel test, offline araç) — 02 düşerse hata. */
export async function renderVitrinImages(input: VitrinImageInput): Promise<Result<[Buffer, Buffer]>> {
  const rendered = await renderVitrinPages(input);
  if (!rendered.ok) return rendered;
  const [posterPng, analysisPng] = rendered.data.pages;
  if (!posterPng || !analysisPng) return { ok: false, error: { code: "LAYOUT_OVERLAP", message: rendered.data.notes.join(" ") } };
  return { ok: true, data: [posterPng, analysisPng] };
}
