import sharp from "sharp";

/**
 * Buzlu cam panellerde yazı/zemin kontrastı (kullanıcı 2026-11-07, düzeltme 2: ≥ 4,5:1). Ölçüm, aynı karenin "yazısız" çiziminde
 * yapılır (`TacticalReel textless`: kutu içindeki yazı, görsel, ikon, çubuk ve çipler gizli): kalan piksel panelin ve arkasındaki
 * sahanın/fotoğrafın gerçek görüntüsüdür. Zemin = kutu içinin (kenar çizgisi dışarıda) %95'lik parlaklığı — yazının denk gelebileceği
 * en açık zemin. İki yazı rengi denetlenir: ana yazı (#F6F8F4) ve yeşil yazı (#4CC456).
 */

export const MIN_CONTRAST = 4.5;
const channel = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const hex = (value: string) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)) as [number, number, number];
export const INK_LUMINANCE = luminance(...hex("#F6F8F4"));
export const GREEN_LUMINANCE = luminance(...hex("#4CC456"));
export const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export interface BoxRect { name: string; x: number; y: number; w: number; h: number }
export interface BoxContrast { name: string; background: number; ink: number; green: number }

export async function boxContrast(textlessPng: string, boxes: readonly BoxRect[]): Promise<BoxContrast[]> {
  const image = sharp(textlessPng);
  const { width = 1080, height = 1920 } = await image.metadata();
  const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const results: BoxContrast[] = [];
  for (const box of boxes) {
    const x0 = Math.max(0, Math.round(box.x + 4)), y0 = Math.max(0, Math.round(box.y + 4));
    const x1 = Math.min(width, Math.round(box.x + box.w - 4)), y1 = Math.min(height, Math.round(box.y + box.h - 4));
    if (x1 <= x0 || y1 <= y0) continue;
    const levels: number[] = [];
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const at = (y * info.width + x) * info.channels;
      levels.push(luminance(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0));
    }
    levels.sort((a, b) => a - b);
    const background = levels[Math.floor(levels.length * 0.95)] ?? 0;
    results.push({ name: box.name, background: Number(background.toFixed(4)), ink: Number(ratio(INK_LUMINANCE, background).toFixed(2)), green: Number(ratio(GREEN_LUMINANCE, background).toFixed(2)) });
  }
  return results;
}
