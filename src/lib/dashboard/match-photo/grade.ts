import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { CropBox } from "./crop";

/**
 * Renk tonlama — kırpılmış fotoğrafa hafif kontrast + split-tone: açık tonlara vurgu rengi,
 * koyu tonlara derin ton (Avrupa'da turnuvanın `deep` rengi, yurt içinde vurgunun koyulaştırılmışı)
 * soft-light ile, parlaklık maskesine göre basılır. Gren ve vinyet burada DEĞİL, set bitişinde
 * (`finalizeSetImage`, maç kimliği tohumlu) eklenir. Ağ çağrısı yok.
 */

type Rgb = [number, number, number];

/** Split-tone yoğunlukları — "hafif": foto kimliği kalır, set rengi hissedilir. */
const HIGHLIGHT_AMOUNT = 0.22;
const SHADOW_AMOUNT = 0.3;
const CONTRAST = 1.08;
const SATURATION = 0.9;
/** Yurt içinde derin ton: vurgu rengi bu oranda kartın koyu zeminine karıştırılır. */
const SHADOW_MIX = 0.72;
const SHADE_BASE: Rgb = [7, 8, 12];

export function hexRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Derin ton: verilmişse o (turnuva), yoksa vurgunun koyu zemine karışmış hâli. */
export function shadowTone(accentHex: string, deepHex: string | undefined): Rgb {
  if (deepHex) return hexRgb(deepHex);
  const accent = hexRgb(accentHex);
  return accent.map((c, i) => Math.round(c + ((SHADE_BASE[i] ?? 0) - c) * SHADOW_MIX)) as Rgb;
}

/** W3C soft-light (0..1). */
function softLight(base: number, blend: number): number {
  if (blend <= 0.5) return base - (1 - 2 * blend) * base * (1 - base);
  const d = base <= 0.25 ? ((16 * base - 12) * base + 4) * base : Math.sqrt(base);
  return base + (2 * blend - 1) * (d - base);
}

/**
 * Yerinde split-tone (RGB, 3 kanal). Parlaklık L: açıkta vurgu `L·HIGHLIGHT`, koyuda derin ton
 * `(1−L)·SHADOW` ağırlığıyla soft-light. Saf fonksiyon — birim test edilir.
 */
export function splitTone(rgb: Uint8Array, highlight: Rgb, shadow: Rgb): Uint8Array {
  const hi = highlight.map((c) => c / 255);
  const lo = shadow.map((c) => c / 255);
  for (let i = 0; i < rgb.length; i += 3) {
    const r = (rgb[i] ?? 0) / 255;
    const g = (rgb[i + 1] ?? 0) / 255;
    const b = (rgb[i + 2] ?? 0) / 255;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const wHi = luma * HIGHLIGHT_AMOUNT;
    const wLo = (1 - luma) * SHADOW_AMOUNT;
    [r, g, b].forEach((base, c) => {
      const toned = base + wHi * (softLight(base, hi[c] ?? 0) - base) + wLo * (softLight(base, lo[c] ?? 0) - base);
      rgb[i + c] = Math.round(Math.min(1, Math.max(0, toned)) * 255);
    });
  }
  return rgb;
}

/** Taşan kadraj (grup fotoğrafı, `GROUP_FIT`) dolgusunun bulanıklığı ve kararması. */
const FILL_BLUR = 36;
const FILL_BRIGHTNESS = 0.55;

/**
 * Kadraj → kart boyutunda RGB. Kutu kaynağın içindeyse düz kırpma; taşıyorsa (grup fotoğrafı) fotoğrafın
 * tamamı ölçekle yerine basılır, taşan alan fotoğrafın bulanık/koyu hâliyle (kart boyutunda) doldurulur.
 */
async function frameRegion(bytes: Buffer, box: CropBox, frame: MatchDayFrame): Promise<Buffer> {
  const upright = sharp(bytes).rotate();
  // Dik (EXIF yönü uygulanmış) ölçü: yön 5–8 genişlik/yüksekliği yer değiştirir.
  const meta = await sharp(bytes).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  const inside = box.left >= 0 && box.top >= 0 && box.left + box.width <= width && box.top + box.height <= height;
  if (inside) return upright.extract(box).resize(frame.width, frame.height, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
  const scale = box.width / frame.width;
  const ix = Math.max(0, box.left);
  const iy = Math.max(0, box.top);
  const iw = Math.min(width, box.left + box.width) - ix;
  const ih = Math.min(height, box.top + box.height) - iy;
  const fill = await sharp(bytes).rotate().resize(frame.width, frame.height, { fit: "cover" }).blur(FILL_BLUR).modulate({ brightness: FILL_BRIGHTNESS }).png().toBuffer();
  const part = await sharp(bytes)
    .rotate()
    .extract({ left: ix, top: iy, width: iw, height: ih })
    .resize(Math.max(1, Math.round(iw / scale)), Math.max(1, Math.round(ih / scale)), { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
  return sharp(fill)
    .composite([{ input: part, left: Math.round((ix - box.left) / scale), top: Math.round((iy - box.top) / scale) }])
    .png()
    .toBuffer();
}

/** Kırp → kart boyutuna ölçekle → kontrast/doygunluk → split-tone → PNG (kart boyutunda sanat katmanı). */
export async function cropAndGrade(bytes: Buffer, box: CropBox, frame: MatchDayFrame, accentHex: string, deepHex: string | undefined): Promise<Buffer> {
  const { data, info } = await sharp(await frameRegion(bytes, box, frame))
    .modulate({ saturation: SATURATION })
    .linear(CONTRAST, -128 * (CONTRAST - 1))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const toned = splitTone(new Uint8Array(data.buffer, data.byteOffset, data.length), hexRgb(accentHex), shadowTone(accentHex, deepHex));
  return sharp(Buffer.from(toned), { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}
