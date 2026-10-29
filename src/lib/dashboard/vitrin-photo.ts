import sharp from "sharp";
import { CARD_SHADE_HEX } from "@/lib/dashboard/color-math";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { planCrop, saliencyPoint, type CropOffset } from "@/lib/dashboard/match-photo/crop";
import { detectFaces } from "@/lib/dashboard/match-photo/faces";
import { cropAndGrade } from "@/lib/dashboard/match-photo/grade";
import { checkPhotoQuality, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import type { FrameBox } from "@/skills/render-engine/templates/match-result/geometry";
import type { PosterGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import type { Result } from "@/types/result";

/**
 * Vitrin carousel'inin sanat katmanları. 01 Poster: iki takımın arşiv fotoğrafı Maç Sonucu hattının
 * yapı taşlarıyla (kalite kapısı, yerel yüz tespiti, akıllı kırpma, split-tone) kendi yarısına
 * yerleştirilir, her yarı kendi takım renginde hafif ışık alır, deplasman yarısı çapraz çizgiden
 * maskelenir. Fotoğrafı olmayan taraf programatik (takım renginde parıltılı koyu zemin).
 * 02 Analiz: posterin sanatının bulanık/koyu hâli (set ailesi). Büyütücü verilmezse Fal'a gidilmez.
 */

export interface VitrinPhotos {
  home: UploadedImage | null;
  away: UploadedImage | null;
}

export type PosterArtGeometry = Pick<PosterGeometry, "photo" | "frame">;

export interface PosterArtInput {
  photos: VitrinPhotos;
  /** Yalnızca fotoğraf bölgesi ve çerçeve okunur — oyuncu karşılaştırma posteri de aynı hattı kullanır. */
  g: PosterArtGeometry;
  homeHex: string;
  awayHex: string;
  upscale?: PhotoUpscaler | undefined;
  /** Elle kırpma ayarı (taraf başına); verilmezse otomatik. */
  adjust?: { home?: CropAdjust | undefined; away?: CropAdjust | undefined } | undefined;
}

/** Elle kırpma: kaydırma (−1..1, kadraj boyunun yarısı) ve zoom (1..1,6); alan yoksa otomatik. */
export interface CropAdjust {
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
}

/** Takım rengi ışığının gücü (soft-light) — "hafif": fotoğrafın kimliği kalır. */
const TEAM_LIGHT_OPACITY = 0.6;
/** Analiz sayfası zemini: bulanıklık (k = 1) ve karartma. */
const ANALYSIS_BLUR = 42;
const ANALYSIS_BRIGHTNESS = 0.42;

/** Fal'sız büyütücü — büyütme gerekiyorsa hata (offline render ve testler). */
export const noUpscale: PhotoUpscaler = async () => ({ ok: false, error: { code: "UPSCALE_DISABLED", message: "Fotoğraf küçük; offline çizimde büyütme kapalı (kısa kenar ≥ 1080 olmalı)." } });

const size = (box: FrameBox) => ({ width: box.right - box.left, height: box.bottom - box.top });

/** Takım rengi ışık: panelin dış kenarından içe doğru sönen renk (soft-light ile basılır). */
function teamLightSvg(width: number, height: number, hex: string, side: "home" | "away"): Buffer {
  const cx = side === "home" ? "0%" : "100%";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="l" cx="${cx}" cy="20%" r="95%"><stop offset="0" stop-color="${hex}" stop-opacity="${TEAM_LIGHT_OPACITY}"/><stop offset="1" stop-color="${hex}" stop-opacity="0.12"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#l)"/></svg>`);
}

async function programmaticPanel(width: number, height: number, hex: string, side: "home" | "away"): Promise<Buffer> {
  const cx = side === "home" ? "30%" : "70%";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="g" cx="${cx}" cy="35%" r="75%"><stop offset="0" stop-color="${hex}" stop-opacity="0.42"/><stop offset="1" stop-color="${CARD_SHADE_HEX}" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="${CARD_SHADE_HEX}"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Tek fotoğraf paneli (kalite kapısı → yüz tespiti → akıllı kırpma / elle ayar → split-tone → takım ışığı);
 * fotoğraf yoksa programatik panel. `safe` panele göre yüzün düşeceği bölge. Muhtemel 11 kapağı da kullanır.
 */
export async function photoPanel(image: UploadedImage | null, panel: FrameBox, safe: FrameBox, frame: MatchDayFrame, hex: string, side: "home" | "away", upscale: PhotoUpscaler, adjust: CropAdjust | undefined): Promise<Result<Buffer>> {
  const { width, height } = size(panel);
  if (!image) return { ok: true, data: await programmaticPanel(width, height, hex, side) };
  const quality = await checkPhotoQuality(image, upscale);
  if (!quality.ok) return quality;
  const source = quality.data.image;
  const faces = await detectFaces(source.bytes, source.hash);
  const dims = { width: source.width, height: source.height };
  const saliency = faces.length > 0 ? null : await saliencyPoint(source.bytes, dims);
  // Elle ayar verilmezse otomatik kırpma (yüz → yazısız bölge, gerekirse otomatik zoom).
  const plan = planCrop({ source: dims, frame: { width, height }, safe, faces, saliency, offset: adjust?.offset, zoom: adjust?.zoom });
  const graded = await cropAndGrade(source.bytes, plan.box, { ...frame, width, height }, hex, undefined);
  const lit = await sharp(graded).composite([{ input: teamLightSvg(width, height, hex, side), blend: "soft-light" }]).png().toBuffer();
  return { ok: true, data: lit };
}

/** Deplasman panelini çapraz çizgiden keser (çizginin solu şeffaf). */
async function maskDiagonal(panelPng: Buffer, panel: FrameBox, g: PosterArtGeometry): Promise<Buffer> {
  const { width, height } = size(panel);
  const top = g.photo.topX - panel.left;
  const bottom = g.photo.bottomX - panel.left;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${top},0 ${width},0 ${width},${height} ${bottom},${height}" fill="#fff"/></svg>`);
  return sharp(panelPng).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

export async function preparePosterArt(input: PosterArtInput): Promise<Result<Buffer>> {
  const { g } = input;
  const upscale = input.upscale ?? noUpscale;
  const { home: homePanel, away: awayPanel } = g.photo.panels;
  const [home, away] = await Promise.all([
    photoPanel(input.photos.home, homePanel, g.photo.safe.home, g.frame, input.homeHex, "home", upscale, input.adjust?.home),
    photoPanel(input.photos.away, awayPanel, g.photo.safe.away, g.frame, input.awayHex, "away", upscale, input.adjust?.away),
  ]);
  if (!home.ok) return { ok: false, error: { ...home.error, message: `Ev sahibi fotoğrafı: ${home.error.message}` } };
  if (!away.ok) return { ok: false, error: { ...away.error, message: `Deplasman fotoğrafı: ${away.error.message}` } };
  const awayMasked = await maskDiagonal(away.data, awayPanel, g);
  const art = await sharp({ create: { width: g.frame.width, height: g.frame.height, channels: 3, background: CARD_SHADE_HEX } })
    .composite([
      { input: home.data, left: homePanel.left, top: homePanel.top },
      { input: awayMasked, left: awayPanel.left, top: awayPanel.top },
    ])
    .png()
    .toBuffer();
  return { ok: true, data: art };
}

/** Analiz sayfasının zemini: posterin sanatı, güçlü bulanık ve karartılmış. */
export async function analysisArt(posterArt: Buffer, k: number): Promise<Buffer> {
  return sharp(posterArt).blur(Math.max(12, ANALYSIS_BLUR * k)).modulate({ brightness: ANALYSIS_BRIGHTNESS }).png().toBuffer();
}
