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

/** Kırp → kart boyutuna ölçekle → kontrast/doygunluk → split-tone → PNG (kart boyutunda sanat katmanı). */
export async function cropAndGrade(bytes: Buffer, box: CropBox, frame: MatchDayFrame, accentHex: string, deepHex: string | undefined): Promise<Buffer> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .extract(box)
    .resize(frame.width, frame.height, { fit: "fill", kernel: "lanczos3" })
    .modulate({ saturation: SATURATION })
    .linear(CONTRAST, -128 * (CONTRAST - 1))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const toned = splitTone(new Uint8Array(data.buffer, data.byteOffset, data.length), hexRgb(accentHex), shadowTone(accentHex, deepHex));
  return sharp(Buffer.from(toned), { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}
