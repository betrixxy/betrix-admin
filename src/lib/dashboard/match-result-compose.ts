import sharp, { type OverlayOptions } from "sharp";
import { LIGHT_PADDING, clipToCanvas, fitCutout, silhouette } from "@/lib/dashboard/match-day-compose";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PlayerSlot } from "@/lib/dashboard/match-day-layouts";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";

/**
 * Maç Sonucu piksel katmanları (CLAUDE.md 3.4): arka plan → ışık süzmesi → oyuncu kesimi(leri).
 * Gradyan ve yazılar Satori katmanındadır (`templates/match-result/`). Kahraman-skor tek MVP'yi
 * `hero` yuvasına, beraberlik varyantı iki oyuncuyu `pair` yuvalarına yerleştirir. Ağ çağrısı yok.
 */

function rgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Fal'sız (Ekonomik/önizleme) zemin: turnuva/takım derin tonunda koyu zemin, oyuncunun arkasında
 * vurgu renginde yumuşak bir ışık havuzu ve kenar karartması. Ücretsizdir.
 */
export function buildResultBackground(frame: MatchDayFrame, accentHex: string, deepHex: string): Promise<Buffer> {
  const { width: w, height: h } = frame;
  const cx = frame.orientation === "landscape" ? 0.27 : 0.5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deepHex}"/><stop offset="1" stop-color="#050507"/></linearGradient>
    <radialGradient id="pool" cx="${cx}" cy="0.34" r="0.55"><stop offset="0" stop-color="${accentHex}" stop-opacity="0.34"/><stop offset="0.55" stop-color="${accentHex}" stop-opacity="0.08"/><stop offset="1" stop-color="${accentHex}" stop-opacity="0"/></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#pool)"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function playerLayers(bytes: Buffer, slot: PlayerSlot, frame: MatchDayFrame, accentHex: string, withLight: boolean): Promise<OverlayOptions[]> {
  const cutout = await fitCutout(bytes, slot);
  const left = Math.round(slot.centerX - cutout.width / 2);
  if (!withLight) {
    const layer = await clipToCanvas(cutout.data, left, slot.top, frame);
    return layer ? [layer] : [];
  }
  const shadow = await silhouette(cutout.data, cutout.width, cutout.height, { r: 0, g: 0, b: 0 }, 0.6);
  const rim = await silhouette(cutout.data, cutout.width, cutout.height, rgb(accentHex), 0.32);
  const layers = await Promise.all([
    clipToCanvas(rim, left - LIGHT_PADDING, slot.top - LIGHT_PADDING - 10, frame),
    clipToCanvas(shadow, left - LIGHT_PADDING + 16, slot.top - LIGHT_PADDING + 20, frame),
    clipToCanvas(cutout.data, left, slot.top, frame),
  ]);
  return layers.filter((layer): layer is OverlayOptions => layer !== null);
}

/**
 * Bir oyuncu → kahraman yerleşimi; iki oyuncu → beraberlik split'i (ev sahibi solda).
 * `withLight: false`: harmanlanmış görselin üstüne orijinal kesimleri yeniden basar (yüz/forma
 * AI tarafından değiştirilmez; ışık/gölge harmanlanmış görselde zaten vardır).
 */
export async function composeResultArt(
  background: Buffer,
  frame: MatchDayFrame,
  players: Buffer[],
  accentHex: string,
  withLight = true,
): Promise<Buffer> {
  const g = matchResultGeometry(frame);
  const slots = players.length === 1 ? [g.hero] : g.pair;
  const layers = await Promise.all(players.map((bytes, index) => playerLayers(bytes, slots[index] ?? g.hero, frame, accentHex, withLight)));
  return sharp(background).resize(frame.width, frame.height, { fit: "cover" }).composite(layers.flat()).png().toBuffer();
}
