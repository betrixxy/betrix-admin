import sharp from "sharp";
import { finalizeMatchDayImage } from "@/lib/dashboard/match-day-compose";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";

/**
 * "CheckMatch set" son dokunuşu — Maç Sonucu (01) ve İstatistik (02) kartı AYNI bitişi alır:
 * hafif vinyet + ~%4 film greni. Gren ortalaması nötr gri (128) olan tek renkli gauss
 * gürültüsüdür ve `overlay` ile basılır: ortalama parlaklık değişmez, yalnızca doku eklenir.
 *
 * Gren TOHUMLUDUR: tohum maç kimliğinden türetilir, aynı kart her çizimde piksel piksel aynı
 * çıkar (görsel regresyon testi ve "yeniden çiz" tutarlılığı için). sharp'ın kendi gürültüsü
 * tohum almadığı için gürültü burada üretilir. Ağ çağrısı yok.
 */

/** Gauss gürültüsünün sapması — 10/255 ≈ %4 genlik. */
const GRAIN_SIGMA = 10;
/** Kenarda vinyetin en koyu değeri. */
const VIGNETTE_EDGE = 0.32;

/** FNV-1a 32 bit — "1636268" → sabit tohum. */
export function grainSeed(key: string | number): number {
  let hash = 0x811c9dc5;
  for (const char of String(key)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** mulberry32 — küçük, hızlı, tohumlu PRNG (0 ≤ x < 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tek kanallı (gri) gauss gürültüsü — Box-Muller, her çağrıda iki örnek. */
export function grainPixels(width: number, height: number, seed: number): Uint8Array {
  const random = mulberry32(seed);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i += 2) {
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const r = Math.sqrt(-2 * Math.log(u)) * GRAIN_SIGMA;
    out[i] = Math.max(0, Math.min(255, Math.round(128 + r * Math.cos(2 * Math.PI * v))));
    if (i + 1 < out.length) out[i + 1] = Math.max(0, Math.min(255, Math.round(128 + r * Math.sin(2 * Math.PI * v))));
  }
  return out;
}

function vignetteSvg(frame: MatchDayFrame): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">
  <defs><radialGradient id="v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${VIGNETTE_EDGE}"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`);
}

/** `seedKey`: maç kimliği — aynı maçın kartları aynı greni alır. */
export async function applyFilmFinish(image: Buffer, frame: MatchDayFrame, seedKey: string | number): Promise<Buffer> {
  const grain = await sharp(Buffer.from(grainPixels(frame.width, frame.height, grainSeed(seedKey))), {
    raw: { width: frame.width, height: frame.height, channels: 1 },
  })
    .toColourspace("srgb")
    .png()
    .toBuffer();
  return sharp(image)
    .composite([{ input: vignetteSvg(frame) }, { input: grain, blend: "overlay" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Set kartının nihai görseli: sanat + yazı katmanı (bkz. `finalizeMatchDayImage`) + vinyet + tohumlu gren. */
export async function finalizeSetImage(art: Buffer, overlayPng: Buffer, frame: MatchDayFrame, seedKey: string | number): Promise<Buffer> {
  return applyFilmFinish(await finalizeMatchDayImage(art, overlayPng, frame), frame, seedKey);
}
