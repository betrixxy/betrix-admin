import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { buildStatsBackground, buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { renderTeamFallback } from "@/lib/dashboard/team-fallback-art";
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

/**
 * Tipografik yedeğin zemini (fotoğraf yok): ORTAK YEDEK TASARIM (`templates/shared/team-fallback.tsx`) kart boyutunda —
 * takım rengi gradyanı + dev filigran arma + arma, fotoğrafın yazısız bölgesinde (16:9'da yazı sütununun karşısı:
 * canlı test 2026-10-31'de sol yarı boş kalıyordu). Dev ad kartın kendi yazı katmanında, zeminde tekrar yazılmaz;
 * dikeyde dev ad fotoğrafın yerinde durduğu için arma çizilmez (filigran + takım ışığı kalır).
 */
export async function typographicBackground(frame: MatchDayFrame, card: SpotlightCard, side: ColumnSide): Promise<Buffer> {
  const safe = spotlightGeometry(frame, card, side).photo.photoSafe;
  const focus = { x: (safe.left + safe.right) / 2 / frame.width, y: frame.orientation === "landscape" ? 0.42 : Math.min(0.4, (safe.top + (safe.bottom - safe.top) * 0.4) / frame.height) };
  const fallbackSide = frame.orientation === "landscape" ? (side === "right" ? "home" : "away") : "center";
  return renderTeamFallback({ name: card.player.teamName, hex: card.player.teamHex, logo: card.player.teamLogo }, frame, { side: fallbackSide, focus, type: false, crest: frame.orientation === "landscape" });
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
    const art = input.art ?? (await typographicBackground(frame, card, input.side));
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
