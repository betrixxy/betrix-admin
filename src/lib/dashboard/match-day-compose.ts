import sharp, { type OverlayOptions } from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { EMBLEM_FOCUS_Y, EmblemPlacementError, placeEmblem, type Box, type ObstacleSpan } from "@/lib/dashboard/match-day-emblem";
import { getMatchDayLayout, type MatchDayLayout, type PlayerSlot } from "@/lib/dashboard/match-day-layouts";
import { renderTeamFallback, type FallbackTeamSource } from "@/lib/dashboard/team-fallback-art";
import { isHex, luminance } from "@/lib/dashboard/color-math";
import type { MatchDayTemplateId } from "@/types/match-day";

/**
 * Maç Günü kartının piksel katmanları (bkz. CLAUDE.md 3.4 z-sırası):
 * arka plan → arka ışık/gölge → oyuncu kesimleri → okunabilirlik gölgesi → (Fal.ai harmanlama)
 * → tipografi/marka katmanı. Ağ çağrısı yok; yalnızca sharp. Tüm ölçüler seçili formattan gelir.
 */

export const LIGHT_PADDING = 90;
const LIGHT_BLUR = 50;
const BOTTOM_FADE_RATIO = 0.24;

export interface PlayerCutout {
  /** birefnet kesimi; null → o takımın yedek tasarımı (arma + filigran + takım ışığı, `team-fallback.tsx`). */
  bytes: Buffer | null;
  colorHex: string;
  /** Kesim yoksa çizilecek takım (ad, renk, logo). */
  team?: FallbackTeamSource | undefined;
}

export interface ComposeTarget {
  template: MatchDayTemplateId;
  frame: MatchDayFrame;
  /** Yazı katmanının ölçülmüş blokları (`matchDayLayoutGate` kutuları) — fotoğrafsız tarafın arması bunlara değmez. */
  textBlocks?: readonly Box[] | undefined;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Kanvas dışına taşan katmanı görünür bölgeye kırpar — sharp taşan ofsetleri kabul etmez. */
export async function clipToCanvas(input: Buffer, left: number, top: number, frame: MatchDayFrame): Promise<OverlayOptions | null> {
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

export async function fitCutout(bytes: Buffer, slot: PlayerSlot): Promise<{ data: Buffer; width: number; height: number }> {
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
export async function silhouette(cutout: Buffer, width: number, height: number, rgb: { r: number; g: number; b: number }, alpha: number): Promise<Buffer> {
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

/** Fotoğraflı taraftaki oyuncunun tuvaldeki kesimi — fotoğrafsız tarafın arması için engel. */
interface PlacedCutout {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Ham alfa (genişlik × yükseklik). */
  alpha: Buffer;
}

/** Engel: verilen satırlarda opak (alfa > 32) piksellerin yatay uzanımı. */
function obstacleOf(cutout: PlacedCutout): ObstacleSpan {
  return (top, bottom) => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    const y0 = Math.max(0, Math.floor(top - cutout.top));
    const y1 = Math.min(cutout.height, Math.ceil(bottom - cutout.top));
    for (let y = y0; y < y1; y += 1) {
      const row = y * cutout.width;
      for (let x = 0; x < cutout.width; x += 1) {
        if ((cutout.alpha[row + x] ?? 0) > 32) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return Number.isFinite(minX) ? { left: cutout.left + minX, right: cutout.left + maxX + 1 } : null;
  };
}

/**
 * Arka ışık armada oyuncudakinin bu oranı: aynı bulanıklıkta toplu bir kalkan, ince bir vücut kenarından daha yoğun
 * hale bırakır — algılanan yoğunluk eşitlensin (canlı test v2: arma "yapıştırılmış" gibi parlıyordu).
 */
const EMBLEM_BACKLIGHT_SCALE = 0.7;

/**
 * Takım tonlu arka ışık rengin PARLAKLIĞIYLA da ölçeklenir: aynı opaklıkta sarı (#FFD200, göreli parlaklık ≈ 0,67)
 * koyu zeminde lacivertten (≈ 0,04) kat kat parlak algılanır — canlı test v3'te Göztepe armasında güçlü sarı hale
 * kalıyordu. Bu parlaklığın üstündeki renklerde opaklık oranla düşer (koyu/orta tonlar aynen).
 */
export const EMBLEM_LIGHT_REFERENCE_LUMINANCE = 0.18;

/** Arma arka ışığının opaklığı (şablon opaklığı × arma oranı × parlaklık dengesi). */
export function emblemBacklightAlpha(alpha: number, tintHex: string | null): number {
  const lum = tintHex && isHex(tintHex) ? luminance(tintHex) : 1;
  return alpha * EMBLEM_BACKLIGHT_SCALE * Math.min(1, EMBLEM_LIGHT_REFERENCE_LUMINANCE / Math.max(lum, 1e-3));
}

/** Armanın opak kısmı (yarı saydam ışık/filigran hariç) — arka ışık ve temas gölgesi bundan türetilir. */
async function crestMask(emblem: Buffer, width: number, height: number): Promise<Buffer> {
  const alpha = await sharp(emblem).ensureAlpha().extractChannel(3).threshold(128).raw().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } }).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/**
 * Fotoğrafsız taraf: oyuncunun yerine şeffaf zeminli yedek tasarım. Işık dili fotoğraflı tarafla AYNI: armanın
 * opak kısmından oyuncudakiyle aynı temas gölgesi (siyah, aynı kayma) ve aynı arka ışık (şablonun tonu/opaklığı);
 * takım rengi yalnızca geniş, düşük opaklıklı bir ışık (sarı hale yok). Yer yerleşim kapısından (`placeEmblem`).
 */
async function emblemLayers(player: PlayerCutout, slot: PlayerSlot, layout: MatchDayLayout, target: ComposeTarget, side: "home" | "away", withLight: boolean, obstacle: PlacedCutout | null): Promise<OverlayOptions[]> {
  const { frame } = target;
  const team = player.team ?? { name: "", hex: player.colorHex, logo: null };
  const placement = placeEmblem(slot, side, layout.bounds, obstacle ? obstacleOf(obstacle) : null, target.textBlocks ?? []);
  if (!placement) throw new EmblemPlacementError(`${team.name || "Fotoğrafsız taraf"} arması oyuncu fotoğrafıyla çakışıyor; kaydırılıp küçültülünce de sığmıyor — kart üretilmedi.`);
  const { width, height, left, top } = placement;
  const emblem = await renderTeamFallback(team, { width, height }, { side, mode: "emblem", focus: { x: 0.5, y: EMBLEM_FOCUS_Y } });
  const layers: (OverlayOptions | null)[] = [];
  if (withLight) {
    const crest = await crestMask(emblem, width, height);
    const shadow = await silhouette(crest, width, height, { r: 0, g: 0, b: 0 }, 0.55);
    layers.push(await clipToCanvas(shadow, left - LIGHT_PADDING + 14, top - LIGHT_PADDING + 18, frame));
    if (layout.backlight) {
      const rgb = layout.backlight.tint === "team" ? hexToRgb(player.colorHex) : { r: 255, g: 255, b: 255 };
      const light = await silhouette(crest, width, height, rgb, emblemBacklightAlpha(layout.backlight.alpha, layout.backlight.tint === "team" ? player.colorHex : null));
      layers.push(await clipToCanvas(light, left - LIGHT_PADDING, top - LIGHT_PADDING, frame));
    }
  }
  layers.push(await clipToCanvas(emblem, left, top, frame));
  return layers.filter((layer): layer is OverlayOptions => layer !== null);
}

/** Fotoğraflı tarafın kesimini yerleştirir (engel ölçümü ve katmanlar aynı yerleşimi kullanır). */
async function placeCutout(bytes: Buffer, slot: PlayerSlot): Promise<{ data: Buffer; placed: PlacedCutout }> {
  const cutout = await fitCutout(bytes, slot);
  const alpha = await sharp(cutout.data).ensureAlpha().extractChannel(3).raw().toBuffer();
  return { data: cutout.data, placed: { left: Math.round(slot.centerX - cutout.width / 2), top: slot.top, width: cutout.width, height: cutout.height, alpha } };
}

async function playerLayers(
  player: PlayerCutout,
  cutout: { data: Buffer; placed: PlacedCutout },
  layout: MatchDayLayout,
  frame: MatchDayFrame,
  withLight: boolean,
): Promise<OverlayOptions[]> {
  const { left, top, width, height } = cutout.placed;
  const layers: (OverlayOptions | null)[] = [];

  if (withLight) {
    // Zemin temas gölgesi — oyuncuyu sahneye "oturtur" (yapıştırılmış görüntüsünü engeller).
    const shadow = await silhouette(cutout.data, width, height, { r: 0, g: 0, b: 0 }, 0.55);
    layers.push(await clipToCanvas(shadow, left - LIGHT_PADDING + 14, top - LIGHT_PADDING + 18, frame));
    if (layout.backlight) {
      const rgb = layout.backlight.tint === "team" ? hexToRgb(player.colorHex) : { r: 255, g: 255, b: 255 };
      const light = await silhouette(cutout.data, width, height, rgb, layout.backlight.alpha);
      layers.push(await clipToCanvas(light, left - LIGHT_PADDING, top - LIGHT_PADDING, frame));
    }
  }
  layers.push(await clipToCanvas(cutout.data, left, top, frame));
  return layers.filter((layer): layer is OverlayOptions => layer !== null);
}

async function layerPlayers(base: Buffer, target: ComposeTarget, home: PlayerCutout, away: PlayerCutout, withLight: boolean): Promise<Buffer> {
  const { frame } = target;
  const layout = getMatchDayLayout(target.template, frame);
  const [homeCut, awayCut] = await Promise.all([home.bytes ? placeCutout(home.bytes, layout.home) : null, away.bytes ? placeCutout(away.bytes, layout.away) : null]);
  const [homeLayers, awayLayers] = await Promise.all([
    homeCut ? playerLayers(home, homeCut, layout, frame, withLight) : emblemLayers(home, layout.home, layout, target, "home", withLight, awayCut?.placed ?? null),
    awayCut ? playerLayers(away, awayCut, layout, frame, withLight) : emblemLayers(away, layout.away, layout, target, "away", withLight, homeCut?.placed ?? null),
  ]);
  // Fotoğrafsız tarafın katmanları oyuncunun ALTINDA: ışığı/filigranı oyuncunun üstüne binmez.
  const ordered = homeCut && !awayCut ? [...awayLayers, ...homeLayers] : [...homeLayers, ...awayLayers];
  return sharp(base)
    .resize(frame.width, frame.height, { fit: "cover" })
    .composite([...ordered, { input: Buffer.from(layout.shadeSvg) }])
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
