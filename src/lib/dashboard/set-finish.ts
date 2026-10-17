import sharp from "sharp";
import { finalizeMatchDayImage } from "@/lib/dashboard/match-day-compose";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";

/**
 * "CheckMatch set" son dokunuşu — Maç Sonucu (01) ve İstatistik (02) kartı AYNI bitişi alır:
 * hafif vinyet + %3-4 film greni. Gren ortalaması nötr gri (128) olan gauss gürültüsüdür ve
 * `overlay` ile basılır: ortalama parlaklık değişmez, yalnızca doku eklenir. Ağ çağrısı yok.
 */

/** Gauss gürültüsünün sapması — 10/255 ≈ %4 genlik. */
const GRAIN_SIGMA = 10;
/** Kenarda vinyetin en koyu değeri. */
const VIGNETTE_EDGE = 0.32;

function vignetteSvg(frame: MatchDayFrame): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">
  <defs><radialGradient id="v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${VIGNETTE_EDGE}"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`);
}

export async function applyFilmFinish(image: Buffer, frame: MatchDayFrame): Promise<Buffer> {
  const grain = await sharp({
    create: { width: frame.width, height: frame.height, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: "gaussian", mean: 128, sigma: GRAIN_SIGMA } },
  })
    .png()
    .toBuffer();
  return sharp(image)
    .composite([{ input: vignetteSvg(frame) }, { input: grain, blend: "overlay" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Set kartının nihai görseli: sanat + yazı katmanı (bkz. `finalizeMatchDayImage`) + vinyet + gren. */
export async function finalizeSetImage(art: Buffer, overlayPng: Buffer, frame: MatchDayFrame): Promise<Buffer> {
  return applyFilmFinish(await finalizeMatchDayImage(art, overlayPng, frame), frame);
}
