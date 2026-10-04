import sharp, { type OverlayOptions } from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { getMatchDayLayout, type MatchDayLayout, type PlayerSlot } from "@/lib/dashboard/match-day-layouts";
import type { MatchDayTemplateId } from "@/types/match-day";

/**
 * Maç Günü kartının piksel katmanları (bkz. CLAUDE.md 3.4 z-sırası):
 * arka plan → arka ışık/gölge → oyuncu kesimleri → okunabilirlik gölgesi → (Fal.ai harmanlama)
 * → tipografi/marka katmanı. Ağ çağrısı yok; yalnızca sharp. Tüm ölçüler seçili formattan gelir.
 */

const LIGHT_PADDING = 90;
const LIGHT_BLUR = 50;
const BOTTOM_FADE_RATIO = 0.24;

export interface PlayerCutout {
  bytes: Buffer;
  colorHex: string;
}

export interface ComposeTarget {
  template: MatchDayTemplateId;
  frame: MatchDayFrame;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Kanvas dışına taşan katmanı görünür bölgeye kırpar — sharp taşan ofsetleri kabul etmez. */
async function clipToCanvas(input: Buffer, left: number, top: number, frame: MatchDayFrame): Promise<OverlayOptions | null> {
  const { width = 0, height = 0 } = await sharp(input).metadata();
  const x0 = Math.max(0, -left);
  const y0 = Math.max(0, -top);
  const x1 = Math.min(width, frame.width - left);
  const y1 = Math.min(height, frame.height - top);
  if (x1 <= x0 || y1 <= y0) return null;
  const clipped = await sharp(input).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  return { input: clipped, left: left + x0, top: top + y0 };
}

/** Kesimin alt kısmı saydamlaşarak biter: belden kırpılmış fotoğraflar sert bir çizgi bırakmaz. */
async function fadeBottom(cutout: Buffer, width: number, height: number): Promise<Buffer> {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
    <stop offset="${1 - BOTTOM_FADE_RATIO}" stop-color="#fff" stop-opacity="1"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`);
  return sharp(cutout).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function fitCutout(bytes: Buffer, slot: PlayerSlot): Promise<{ data: Buffer; width: number; height: number }> {
  const trimmed = await sharp(bytes).ensureAlpha().trim().png().toBuffer();
  const { data, info } = await sharp(trimmed)
    .resize({ width: slot.maxWidth, height: slot.maxHeight, fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data: await fadeBottom(data, info.width, info.height), width: info.width, height: info.height };
}

/**
 * Oyuncu siluetinden türetilmiş yumuşak ışık/gölge: renkli → arka aydınlatma, siyah → temas
 * gölgesi. Düşük opaklık ve geniş bulanıklık: gerçek bir stüdyo/stadyum ışığı gibi, parlama değil.
 */
async function silhouette(cutout: Buffer, width: number, height: number, rgb: { r: number; g: number; b: number }, alpha: number): Promise<Buffer> {
  const solid = await sharp({ create: { width, height, channels: 4, background: { ...rgb, alpha } } })
    .composite([{ input: cutout, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(solid)
    .extend({ top: LIGHT_PADDING, bottom: LIGHT_PADDING, left: LIGHT_PADDING, right: LIGHT_PADDING, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(LIGHT_BLUR)
    .png()
    .toBuffer();
}

async function playerLayers(
  player: PlayerCutout,
  slot: PlayerSlot,
  layout: MatchDayLayout,
  frame: MatchDayFrame,
  withLight: boolean,
): Promise<OverlayOptions[]> {
  const cutout = await fitCutout(player.bytes, slot);
  const left = Math.round(slot.centerX - cutout.width / 2);
  const top = slot.top;
  const layers: (OverlayOptions | null)[] = [];

  if (withLight) {
    // Zemin temas gölgesi — oyuncuyu sahneye "oturtur" (yapıştırılmış görüntüsünü engeller).
    const shadow = await silhouette(cutout.data, cutout.width, cutout.height, { r: 0, g: 0, b: 0 }, 0.55);
    layers.push(await clipToCanvas(shadow, left - LIGHT_PADDING + 14, top - LIGHT_PADDING + 18, frame));
    if (layout.backlight) {
      const rgb = layout.backlight.tint === "team" ? hexToRgb(player.colorHex) : { r: 255, g: 255, b: 255 };
      const light = await silhouette(cutout.data, cutout.width, cutout.height, rgb, layout.backlight.alpha);
      layers.push(await clipToCanvas(light, left - LIGHT_PADDING, top - LIGHT_PADDING, frame));
    }
  }
  layers.push(await clipToCanvas(cutout.data, left, top, frame));
  return layers.filter((layer): layer is OverlayOptions => layer !== null);
}

async function layerPlayers(base: Buffer, target: ComposeTarget, home: PlayerCutout, away: PlayerCutout, withLight: boolean): Promise<Buffer> {
  const { frame } = target;
  const layout = getMatchDayLayout(target.template, frame);
  const [homeLayers, awayLayers] = await Promise.all([
    playerLayers(home, layout.home, layout, frame, withLight),
    playerLayers(away, layout.away, layout, frame, withLight),
  ]);
  return sharp(base)
    .resize(frame.width, frame.height, { fit: "cover" })
    .composite([...homeLayers, ...awayLayers, { input: Buffer.from(layout.shadeSvg) }])
    .png()
    .toBuffer();
}

/** Fal.ai harmanlamasına giden kaba kompozit: arka plan + ışık/gölge + oyuncular + okunabilirlik gölgesi. */
export function composeMatchDayArt(background: Buffer, target: ComposeTarget, home: PlayerCutout, away: PlayerCutout): Promise<Buffer> {
  return layerPlayers(background, target, home, away, true);
}

/**
 * "Oyuncuları birebir koru" seçiliyse: harmanlanmış görselin üstüne orijinal kesimler yeniden
 * basılır — yüz/forma detayı AI tarafından değiştirilmez, ışık ve arka plan harmanlanmış kalır.
 */
export function restorePlayers(harmonized: Buffer, target: ComposeTarget, home: PlayerCutout, away: PlayerCutout): Promise<Buffer> {
  return layerPlayers(harmonized, target, home, away, false);
}

/**
 * AI'sız zemin (veri şablonu): kurumsal veri ajansı grafiklerindeki gibi koyu düz zemin, altta
 * takım rengi bir şerit ve çok hafif bir ışık. Ücretsizdir — Fal.ai'ye gidilmez.
 */
export function buildProgrammaticBackground(frame: MatchDayFrame, accentHex: string): Promise<Buffer> {
  const { width: w, height: h } = frame;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121216"/><stop offset="1" stop-color="#050507"/></linearGradient>
    <radialGradient id="light" cx="0.78" cy="0.35" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#light)"/>
  <rect x="0" y="${h - 8}" width="${w}" height="8" fill="${accentHex}" fill-opacity="0.85"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Son dokunuş: kanvas boyutuna oturt, hafif netleştir ve tipografi/marka katmanını bas. */
export function finalizeMatchDayImage(art: Buffer, overlayPng: Buffer, frame: MatchDayFrame): Promise<Buffer> {
  return sharp(art)
    .resize(frame.width, frame.height, { fit: "cover" })
    .sharpen({ sigma: 0.7 })
    .composite([{ input: overlayPng }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
