import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { noUpscale, photoPanel, type CropAdjust } from "@/lib/dashboard/vitrin-photo";
import type { LineupGeometry } from "@/skills/render-engine/templates/lineup/lineup-geometry";
import type { LineupHeroAdjust, LineupPalette } from "@/types/lineup";
import type { Result } from "@/types/result";
import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";

/**
 * Muhtemel 11 "Kahraman Liste" kapağının sanat katmanı (Satori yazı katmanının ALTINDA; yerleşim kapısı
 * yalnızca yazı/logo bloklarını ölçer). Fotoğraf Vitrin/Oyuncu Karşılaştırması hattından geçer
 * (`vitrin-photo.ts::photoPanel`: kalite kapısı, yerel yüz tespiti, akıllı kırpma ya da elle ayar,
 * split-tone, takım rengi ışığı); kartın kendi paletinden (logodan) degrade zemine basılır, listenin
 * arkasında zemine söner, başlığın arkasında hafif kararır. DB'siz — motor, önizleme ve görsel test ortak.
 */

/** Başlık bölgesinde fotoğrafın üstüne binen gece tonu (okunurluk) — üstten bu oranla iner. */
const TOP_SHADE_OPACITY = 0.7;

/** Sosyal formatın `cropAndGrade`'e giden çerçeve karşılığı (yalnızca ölçü ve bantlar okunur). */
export function socialFrame(format: SocialFormatId): MatchDayFrame {
  const f = SOCIAL_FORMATS[format];
  return { id: "IG_PORTRAIT", label: f.label, platform: f.platforms, ratioLabel: f.ratioLabel, width: f.width, height: f.height, orientation: f.orientation, safeTop: f.safeTop, safeBottom: f.safeBottom };
}

export const toCropAdjust = (adjust: LineupHeroAdjust | null | undefined): CropAdjust | undefined =>
  adjust ? { offset: { x: adjust.x, y: adjust.y }, ...(adjust.zoom === null ? {} : { zoom: adjust.zoom }) } : undefined;

function backgroundSvg(g: LineupGeometry, palette: LineupPalette): Buffer {
  const glowX = Math.round((g.photo.box.left + g.photo.box.right) / 2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${palette.backgroundTop}"/><stop offset="1" stop-color="${palette.backgroundBottom}"/></linearGradient>
      <radialGradient id="glow" cx="${glowX}" cy="${Math.round(g.height * 0.42)}" r="${Math.round(g.height * 0.55)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${palette.glow}" stop-opacity="0.3"/><stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/><rect width="100%" height="100%" fill="url(#glow)"/></svg>`);
}

/** Fotoğrafı kenarlarında zemine söndüren maske (beyaz = görünür) + üstte okunurluk gölgesi. */
function fadeMaskSvg(width: number, height: number, fade: LineupGeometry["photo"]["fade"]): Buffer {
  const stop = (x: number) => `${Math.round((x / width) * 1000) / 10}%`;
  const left = fade.left ? `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${stop(fade.left[1])}" stop-color="#fff" stop-opacity="1"/>` : `<stop offset="0" stop-color="#fff" stop-opacity="1"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="0">${left}<stop offset="${stop(fade.right[0])}" stop-color="#fff" stop-opacity="1"/><stop offset="${stop(fade.right[1])}" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#m)"/></svg>`);
}

function topShadeSvg(width: number, height: number, until: number, night: string): Buffer {
  const end = Math.min(0.95, until / height);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night}" stop-opacity="${TOP_SHADE_OPACITY}"/><stop offset="${end}" stop-color="${night}" stop-opacity="0"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#s)"/></svg>`);
}

export interface LineupHeroArtInput {
  g: LineupGeometry;
  format: SocialFormatId;
  palette: LineupPalette;
  photo: UploadedImage;
  adjust?: LineupHeroAdjust | null | undefined;
  upscale?: PhotoUpscaler | undefined;
}

export async function lineupHeroArt(input: LineupHeroArtInput): Promise<Result<Buffer>> {
  const { g, palette } = input;
  const { box, safe, fade } = g.photo;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  // Işık ve split-tone takım renginden (paletin parıltısı = logonun baskın tonu).
  const panel = await photoPanel(input.photo, box, safe, socialFrame(input.format), palette.glow, "home", input.upscale ?? noUpscale, toCropAdjust(input.adjust));
  if (!panel.ok) return { ok: false, error: { ...panel.error, message: `Kapak fotoğrafı: ${panel.error.message}` } };
  const shaded = await sharp(panel.data).composite([{ input: topShadeSvg(width, height, g.photo.safe.top, palette.backgroundBottom) }]).png().toBuffer();
  const faded = await sharp(shaded).ensureAlpha().composite([{ input: fadeMaskSvg(width, height, fade), blend: "dest-in" }]).png().toBuffer();
  const art = await sharp(backgroundSvg(g, palette))
    .composite([{ input: faded, left: box.left, top: box.top }])
    .png()
    .toBuffer();
  return { ok: true, data: art };
}
