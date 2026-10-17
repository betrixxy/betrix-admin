import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";

/**
 * Maç İstatistikleri piksel zemini (CLAUDE.md 3.4: arka plan → ışık süzmesi). Premium'da Fal'ın
 * stadyum sahnesi ağır bulanıklaştırılıp karartılır (yalnızca doku; okunabilirliği yazı paneli
 * taşır); Ekonomik modda Fal'sız programatik gradyan. İki yandan takım renginde yumuşak ışık
 * her iki modda da programatiktir — sahne takım renginden bağımsızdır, önbellek tüm maçlarda ortak.
 */

function lightsSvg(frame: MatchDayFrame, homeHex: string, awayHex: string, withBase: boolean): string {
  const { width: w, height: h } = frame;
  const landscape = frame.orientation === "landscape";
  const r = landscape ? 0.55 : 0.7;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11141C"/><stop offset="0.55" stop-color="#090B10"/><stop offset="1" stop-color="#040507"/></linearGradient>
    <radialGradient id="home" cx="-0.08" cy="${landscape ? 0.45 : 0.3}" r="${r}"><stop offset="0" stop-color="${homeHex}" stop-opacity="0.34"/><stop offset="0.5" stop-color="${homeHex}" stop-opacity="0.1"/><stop offset="1" stop-color="${homeHex}" stop-opacity="0"/></radialGradient>
    <radialGradient id="away" cx="1.08" cy="${landscape ? 0.45 : 0.3}" r="${r}"><stop offset="0" stop-color="${awayHex}" stop-opacity="0.34"/><stop offset="0.5" stop-color="${awayHex}" stop-opacity="0.1"/><stop offset="1" stop-color="${awayHex}" stop-opacity="0"/></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
  </defs>
  ${withBase ? '<rect width="100%" height="100%" fill="url(#base)"/>' : ""}
  <rect width="100%" height="100%" fill="url(#home)"/>
  <rect width="100%" height="100%" fill="url(#away)"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
</svg>`;
}

const RESULT_BLUR = 40;
const RESULT_DARKEN = 0.7;

/**
 * Set zemini: aynı maçın Maç Sonucu kartı varsa onun nihai görseli — ağır bulanık (≈40px) ve %70
 * siyahla koyulaştırılmış. Carousel'de 01'den 02'ye geçişte renk ve ışık sürer; yazılar okunmaz
 * hale gelir (yalnızca doku kalır). Ücretsizdir, ağ çağrısı yok.
 */
export async function buildStatsBackgroundFromResult(frame: MatchDayFrame, resultImage: Buffer): Promise<Buffer> {
  const blurred = await sharp(resultImage).resize(frame.width, frame.height, { fit: "cover" }).blur(RESULT_BLUR).png().toBuffer();
  const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><rect width="100%" height="100%" fill="#000" fill-opacity="${RESULT_DARKEN}"/></svg>`);
  return sharp(blurred).composite([{ input: shade }]).png().toBuffer();
}

/** `stadium`: Fal sahnesi (önbellekli) ya da null (Ekonomik — programatik zemin). Ağ çağrısı yok. */
export async function buildStatsBackground(frame: MatchDayFrame, homeHex: string, awayHex: string, stadium: Buffer | null): Promise<Buffer> {
  const lights = Buffer.from(lightsSvg(frame, homeHex, awayHex, stadium === null));
  if (!stadium) return sharp(lights).png().toBuffer();
  const base = await sharp(stadium)
    .resize(frame.width, frame.height, { fit: "cover" })
    .blur(26)
    .modulate({ brightness: 0.38, saturation: 0.55 })
    .png()
    .toBuffer();
  return sharp(base).composite([{ input: lights }]).png().toBuffer();
}
