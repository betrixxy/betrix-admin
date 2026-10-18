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
  const region =
    orientation === "landscape"
      ? { left: g.shadeStart, top: 0, width: width - g.shadeStart, height }
      : { left: 0, top: g.shadeStart, width, height: height - g.shadeStart };
  const { channels } = await sharp(art).extract(region).removeAlpha().stats();
  const [r, g2, b] = channels.map((channel) => channel.mean / 255);
  return 0.2126 * (r ?? 0) + 0.7152 * (g2 ?? 0) + 0.0722 * (b ?? 0);
}
