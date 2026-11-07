import sharp from "sharp";
import { MIN_CONTRAST, parseRgb, relativeLuminance, worstContrast, type TextSample } from "../../src/lib/layout-check";

/** Metin rengi ile metnin arkasındaki pikseller (metin gizlenerek çizilmiş kare) arasındaki en kötü kontrast. */
export async function contrastOf(masked: string, samples: readonly TextSample[]): Promise<{ found: string[]; lowest: number }> {
  const { data, info } = await sharp(masked).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lowest = Number.POSITIVE_INFINITY;
  const found: string[] = [];
  for (const sample of samples) {
    const rgb = parseRgb(sample.color);
    if (!rgb) continue;
    const luminances: number[] = [];
    for (let y = Math.max(0, Math.floor(sample.y)); y < Math.min(info.height, Math.ceil(sample.y + sample.height)); y += 3) {
      for (let x = Math.max(0, Math.floor(sample.x)); x < Math.min(info.width, Math.ceil(sample.x + sample.width)); x += 3) {
        const at = (y * info.width + x) * 3;
        luminances.push(relativeLuminance(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0));
      }
    }
    const ratio = worstContrast(relativeLuminance(...rgb), luminances);
    lowest = Math.min(lowest, ratio);
    if (ratio < MIN_CONTRAST) found.push(`kontrast ${ratio.toFixed(2)}: ${sample.name}`);
  }
  return { found: [...new Set(found)], lowest };
}

/** İki karenin ortalama piksel farkı (0–255): video sonu başa akıcı dönüyor mu. */
export async function loopDifference(first: string, last: string): Promise<number> {
  const [a, b] = await Promise.all([first, last].map((file) => sharp(file).removeAlpha().raw().toBuffer()));
  if (!a || !b) return 255;
  let sum = 0;
  for (let at = 0; at < a.length; at += 1) sum += Math.abs((a[at] ?? 0) - (b[at] ?? 0));
  return sum / a.length;
}
