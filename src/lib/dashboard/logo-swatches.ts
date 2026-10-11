import { BasicPipeline, Vibrant } from "@vibrant/core";
import { DefaultGenerator } from "@vibrant/generator-default";
import { ImageBase, type ImageData, type ImageSource } from "@vibrant/image";
import { MMCQ } from "@vibrant/quantizer-mmcq";
import sharp from "sharp";
import type { LogoSwatches } from "@/types/lineup";

/**
 * Takım logosundan baskın renkler (node-vibrant algoritması: MMCQ niceleme + varsayılan swatch üreticisi).
 * `node-vibrant/node` yerine çekirdek paketler kullanılır: onun görsel çözücüsü (jimp) açık güvenlik
 * uyarısı taşıyor; biz zaten projede olan sharp ile çözüyoruz. Sonuç logo adresi başına süreç içinde
 * önbelleklenir (logo değişmez); okunamayan logo null döner ve önbelleğe girmez — kart forma rengiyle çizilir.
 */

/** Logo zaten küçültülmüş gelir (render tarafında ≤272px); renk için 128px fazlasıyla yeter. */
const ANALYSIS_SIDE = 128;
const MAX_CACHE = 500;

/** sharp ile çözülmüş RGBA pikseller — Vibrant'ın `Image` arayüzü. Küçültme yüklemede yapılır. */
class SharpImage extends ImageBase {
  private data: ImageData | null = null;

  private loaded(): ImageData {
    if (!this.data) throw new Error("Logo yüklenmedi.");
    return this.data;
  }

  async load(image: ImageSource): Promise<SharpImage> {
    if (!Buffer.isBuffer(image)) throw new Error("Logo yalnızca Buffer olarak okunur.");
    const { data, info } = await sharp(image)
      .resize({ width: ANALYSIS_SIDE, height: ANALYSIS_SIDE, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    this.data = { data, width: info.width, height: info.height };
    return this;
  }

  clear(): void {}
  update(imageData: ImageData): void {
    this.data = imageData;
  }
  getWidth(): number {
    return this.loaded().width;
  }
  getHeight(): number {
    return this.loaded().height;
  }
  /** `quality: 1` ile çağrılmaz — küçültme `load` içinde. */
  resize(): void {}
  getPixelCount(): number {
    return this.getWidth() * this.getHeight();
  }
  getImageData(): ImageData {
    return this.loaded();
  }
  remove(): void {
    this.data = null;
  }
}

// node-vibrant'ın varsayılan hattı: şeffaf ve neredeyse beyaz pikseller (logo zemini) sayılmaz.
// eslint-disable-next-line react-hooks/rules-of-hooks -- React hook değil: Vibrant'ın statik hat kaydı.
Vibrant.use(
  new BasicPipeline().filter
    .register("default", (r: number, g: number, b: number, a: number) => a >= 125 && !(r > 250 && g > 250 && b > 250))
    .quantizer.register("mmcq", MMCQ)
    .generator.register("default", DefaultGenerator),
);

const cache = new Map<string, LogoSwatches>();

/** Renkli piksel: doygunluk ≥ 0.35 ve parlaklık ≥ 0.2 (HSV) — siyah, gri, beyaz sayılmaz. */
const MIN_SATURATION = 0.35;
const MIN_VALUE = 0.2;

/** Logo zemini (şeffaf/beyaz) dışındaki piksellerin renkli olanlarının oranı. */
async function chromaticShare(bytes: Buffer): Promise<number> {
  const image = await new SharpImage().load(bytes);
  const { data } = image.getImageData();
  let counted = 0;
  let chromatic = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [r, g, b, a] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0];
    if (a < 125 || (r > 250 && g > 250 && b > 250)) continue;
    counted += 1;
    const max = Math.max(r, g, b);
    if (max / 255 >= MIN_VALUE && (max - Math.min(r, g, b)) / max >= MIN_SATURATION) chromatic += 1;
  }
  return counted ? chromatic / counted : 0;
}

async function extract(bytes: Buffer): Promise<LogoSwatches> {
  const [palette, share] = await Promise.all([
    new Vibrant(bytes, { ImageClass: SharpImage, quality: 1, quantizer: "mmcq", generators: ["default"], filters: ["default"] }).getPalette(),
    chromaticShare(bytes),
  ]);
  const hex = (name: keyof typeof palette) => palette[name]?.hex ?? null;
  return {
    chromaticShare: share,
    vibrant: hex("Vibrant"),
    darkVibrant: hex("DarkVibrant"),
    lightVibrant: hex("LightVibrant"),
    muted: hex("Muted"),
    darkMuted: hex("DarkMuted"),
    lightMuted: hex("LightMuted"),
  };
}

/** `data:image/...;base64,` logodan swatch'lar; `cacheKey` = logonun kaynak adresi. */
export async function logoSwatches(cacheKey: string, logoDataUrl: string): Promise<LogoSwatches | null> {
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const base64 = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(logoDataUrl)?.[1];
  if (!base64) return null;
  try {
    const swatches = await extract(Buffer.from(base64, "base64"));
    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(cacheKey, swatches);
    return swatches;
  } catch (cause) {
    console.error("[lineup] logo renkleri okunamadı:", cause);
    return null;
  }
}
