import sharp from "sharp";
import type { ResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";

/**
 * Okunurluk — yazı bölgesinin (dikeyde gradyan başlangıcından alta, yatayda sağ sütun) ölçülen
 * ortalama parlaklığı → gradyan gücü (0..1, `Shade` bileşeni). Koyu fotoğrafta gradyan hafif kalır
 * (fotoğraf görünür), açık zeminde (beyaz forma, güneşli tribün) güçlenir ve erken başlar.
 */

/** Bu parlaklığın altı "zaten koyu" → en hafif gradyan; üstü → tam güç. */
const DARK = 0.12;
const BRIGHT = 0.5;
const MIN_STRENGTH = 0.2;

export function shadeStrengthFor(luminance: number): number {
  const t = Math.min(1, Math.max(0, (luminance - DARK) / (BRIGHT - DARK)));
  return Math.round((MIN_STRENGTH + (1 - MIN_STRENGTH) * t) * 100) / 100;
}

/** Yazı bölgesinin ortalama parlaklığı (0..1, Rec.709 luma) — kart boyutundaki sanat katmanında. */
export async function textRegionLuminance(art: Buffer, g: ResultGeometry): Promise<number> {
  const { width, height, orientation } = g.frame;
  // `shadeStart` gradyan yönünde kenardan uzaklıktır: sol sütunda sağ kenardan ölçülür.
  const region =
    orientation !== "landscape"
      ? { left: 0, top: g.shadeStart, width, height: height - g.shadeStart }
      : g.side === "left"
        ? { left: 0, top: 0, width: width - g.shadeStart, height }
        : { left: g.shadeStart, top: 0, width: width - g.shadeStart, height };
  const measure = async (box: { left: number; top: number; width: number; height: number }) => {
    const { channels } = await sharp(art).extract(box).removeAlpha().stats();
    const [r, g2, b] = channels.map((channel) => channel.mean / 255);
    return 0.2126 * (r ?? 0) + 0.7152 * (g2 ?? 0) + 0.0722 * (b ?? 0);
  };
  // C · Manşet: üstteki başlık bandı da yazı bölgesidir — ikisinden açık olanı belirler.
  const band = g.titleBand ? await measure({ left: 0, top: 0, width, height: Math.min(height, g.titleBand.bottom) }) : 0;
  return Math.max(band, await measure(region));
}

/**
 * Set zemini (02–06: 01'in bulanık hâli) — AYNI okunurluk ilkesiyle (2026-10-31): sabit %70 karartma yerine
 * zeminin ölçülen parlaklığından karartma. Canlı testte sabit karartma 01'i neredeyse siyaha indiriyordu (set
 * sürekliliği kayboluyordu). Kural: bulanık görselin AÇIK bölgelerinin (kaba ızgarada %90'lık dilim) karartma
 * sonrası parlaklığı `BACKDROP_MAX_LUMA`yı aşmaz — beyaz yazı en açık bölgede bile ≥ 7:1 kontrast (WCAG AAA)
 * bulur; koyu fotoğraf daha az karartılır (zemin görünür), açık fotoğraf daha çok.
 */
export const BACKDROP_MAX_LUMA = 0.26;
export const BACKDROP_MIN_DARKEN = 0.3;
export const BACKDROP_MAX_DARKEN = 0.8;

/** Karartma oranı (0..1, siyah örtünün opaklığı) — `brightLuminance`: açık bölgelerin parlaklığı (0..1). */
export function backdropDarkenFor(brightLuminance: number): number {
  const needed = brightLuminance > 0 ? 1 - BACKDROP_MAX_LUMA / brightLuminance : 0;
  return Math.round(Math.min(BACKDROP_MAX_DARKEN, Math.max(BACKDROP_MIN_DARKEN, needed)) * 100) / 100;
}

/** Görselin açık bölgelerinin parlaklığı: 9×16 ızgarada hücre parlaklıklarının %90'lık dilimi (Rec.709 luma). */
export async function brightLuminance(image: Buffer): Promise<number> {
  const { data, info } = await sharp(image).removeAlpha().resize(9, 16, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const cells: number[] = [];
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * info.channels;
    cells.push((0.2126 * (data[o] ?? 0) + 0.7152 * (data[o + 1] ?? 0) + 0.0722 * (data[o + 2] ?? 0)) / 255);
  }
  cells.sort((a, b) => a - b);
  return cells[Math.min(cells.length - 1, Math.floor(cells.length * 0.9))] ?? 0;
}
