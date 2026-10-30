import sharp from "sharp";
import { channels } from "@/lib/dashboard/color-math";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { buildStatsBackground, buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { renderSatori } from "@/skills/render-engine/satori-text";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import { spotlightGeometry, topPlayersGeometry } from "@/skills/render-engine/templates/player-stats/geometry";
import { SpotlightTemplate } from "@/skills/render-engine/templates/player-stats/spotlight";
import { TopPlayersTemplate } from "@/skills/render-engine/templates/player-stats/top-players";
import type { SpotlightCard, TopPlayersCard } from "@/types/player-match-stats";
import type { Result } from "@/types/result";

/**
 * Oyuncu İstatistikleri görsellerinin çizimi — DB'siz (motor, Maç Sonucu carousel'i, görsel test ve offline
 * script ortak kullanır). YERLEŞİM KAPISI: hiçbir blok başka blokla ya da güvenli kenarla çakışmaz, her öğe
 * bir bloğa aittir (logo dahil); çakışma varsa görsel üretilmez, sebep yazılır. Set bitişi (vinyet + maç
 * kimliği tohumlu gren) 01/02 ile aynı.
 */

type RenderError = { code: string; message: string };

async function png(element: React.ReactElement, frame: MatchDayFrame): Promise<Buffer> {
  const response = renderSatori(element, { width: frame.width, height: frame.height, fonts: await loadMatchDayFonts() });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

export function renderSpotlightOverlay(card: SpotlightCard, frame: MatchDayFrame, options: { side: ColumnSide; shadeStrength: number; only?: BlockFilter }): Promise<Buffer> {
  return png(<SpotlightTemplate card={card} g={spotlightGeometry(frame, card, options.side)} shadeStrength={options.shadeStrength} only={options.only} />, frame);
}

export function renderTopPlayersOverlay(card: TopPlayersCard, frame: MatchDayFrame, options: { only?: BlockFilter } = {}): Promise<Buffer> {
  return png(<TopPlayersTemplate card={card} g={topPlayersGeometry(frame, card)} only={options.only} />, frame);
}

const mix = (hex: string, toward: [number, number, number], amount: number) => {
  const [r, g, b] = channels(hex);
  const c = (value: number, target: number) => Math.round(value + (target - value) * amount);
  return `rgb(${c(r, toward[0])},${c(g, toward[1])},${c(b, toward[2])})`;
};

/**
 * Tipografik yedeğin zemini (fotoğraf yok): üstte takım renginin koyu tonu, alta doğru kart koyusuna (yazı
 * bloğu) iner; sol üstte takım renginde ışık, çok hafif çapraz doku. Programatik, ücretsiz.
 */
export async function typographicBackground(frame: MatchDayFrame, teamHex: string): Promise<Buffer> {
  const { width: w, height: h } = frame;
  const dark: [number, number, number] = [7, 8, 12];
  const top = mix(teamHex, dark, 0.5);
  const mid = mix(teamHex, dark, 0.8);
  const landscape = frame.orientation === "landscape";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="${landscape ? 1 : 0}" y2="${landscape ? 0 : 1}"><stop offset="0" stop-color="${top}"/><stop offset="0.5" stop-color="${mid}"/><stop offset="1" stop-color="#07080C"/></linearGradient>
    <radialGradient id="glow" cx="0.12" cy="0.08" r="0.8"><stop offset="0" stop-color="${teamHex}" stop-opacity="0.32"/><stop offset="1" stop-color="${teamHex}" stop-opacity="0"/></radialGradient>
    <pattern id="lines" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="2" height="28" fill="#fff" fill-opacity="0.035"/></pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect width="100%" height="100%" fill="url(#lines)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export interface SpotlightImageInput {
  card: SpotlightCard;
  frame: MatchDayFrame;
  /** Tonlanmış tam kadraj fotoğraf (kart boyutunda); null → tipografik yedek. */
  art: Buffer | null;
  shadeStrength: number;
  side: ColumnSide;
  seedKey: string | number;
}

export async function renderSpotlightImage(input: SpotlightImageInput): Promise<Result<Buffer, RenderError>> {
  const { card, frame } = input;
  const options = { side: input.side, shadeStrength: input.shadeStrength };
  // Bahis dili kapısı (kart metni) — ortak tek kapı.
  const language = contentLanguageGate({ card });
  if (language) return { ok: false, error: { code: BANNED_LANGUAGE, message: `${language} — kart üretilmedi.` } };
  try {
    const gate = await layoutGate("Maçın Oyuncusu", frame, (only) => renderSpotlightOverlay(card, frame, { ...options, only }));
    if (!gate.ok) return { ok: false, error: gate.error };
    const art = input.art ?? (await typographicBackground(frame, card.player.teamHex));
    return { ok: true, data: await finalizeSetImage(art, await renderSpotlightOverlay(card, frame, options), frame, input.seedKey) };
  } catch (error: unknown) {
    console.error(`[player-stats] A ${frame.id} çizilemedi:`, error);
    return { ok: false, error: { code: "RENDER_FAILED", message: `Oyuncu kartı çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}` } };
  }
}

export interface TopPlayersImageInput {
  card: TopPlayersCard;
  frame: MatchDayFrame;
  /** Carousel'de 01 Maç Sonucu nihai görseli (bulanık zemin); yoksa programatik zemin iki takım renginde. */
  resultImage: Buffer | null;
  teamHexes: [string, string];
  seedKey: string | number;
}

export async function renderTopPlayersImage(input: TopPlayersImageInput): Promise<Result<Buffer, RenderError>> {
  const { card, frame } = input;
  const language = contentLanguageGate({ card });
  if (language) return { ok: false, error: { code: BANNED_LANGUAGE, message: `${language} — kart üretilmedi.` } };
  try {
    const gate = await layoutGate("Maçın En İyileri", frame, (only) => renderTopPlayersOverlay(card, frame, { only }));
    if (!gate.ok) return { ok: false, error: gate.error };
    const background = input.resultImage ? await buildStatsBackgroundFromResult(frame, input.resultImage) : await buildStatsBackground(frame, input.teamHexes[0], input.teamHexes[1], null);
    return { ok: true, data: await finalizeSetImage(background, await renderTopPlayersOverlay(card, frame), frame, input.seedKey) };
  } catch (error: unknown) {
    console.error(`[player-stats] B ${frame.id} çizilemedi:`, error);
    return { ok: false, error: { code: "RENDER_FAILED", message: `En iyiler kartı çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}` } };
  }
}
