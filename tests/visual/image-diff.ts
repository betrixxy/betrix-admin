import sharp from "sharp";

/**
 * İki PNG'yi piksel piksel karşılaştırır. Bir piksel, RGBA kanallarından herhangi birindeki fark
 * `channelTolerance`'ı aşarsa "farklı" sayılır — yazı kenar yumuşatmasındaki ±1-2'lik gürültü yok sayılır.
 * Fark görseli: farklı pikseller kırmızı, geri kalanı soluk gri.
 */

/**
 * Bütün görsel testlerin ORTAK eşiği: farklı piksel oranı ≤ %0,002 (4:5 kartta ≈ 27 piksel). Satori + sharp
 * çizimi aynı makinede bayt bayt deterministik; eski %0,2 eşik tek harflik / tarih biçimi değişikliğini
 * (kartın %0,1–0,3ü) göremiyordu. Kanal toleransı (32) kenar yumuşatma gürültüsünü yine yok sayar.
 */
export const MAX_DIFF_RATIO = 0.00002;

export interface ImageDiff {
  sizeMismatch: boolean;
  diffRatio: number;
  diffPng: Buffer | null;
}

export async function diffPng(actual: Buffer, expected: Buffer, channelTolerance = 32): Promise<ImageDiff> {
  const a = await sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { sizeMismatch: true, diffRatio: 1, diffPng: null };
  }

  const { width, height } = a.info;
  const out = Buffer.alloc(width * height * 4);
  let different = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    let max = 0;
    for (let c = 0; c < 4; c++) max = Math.max(max, Math.abs((a.data[o + c] ?? 0) - (b.data[o + c] ?? 0)));
    const hit = max > channelTolerance;
    if (hit) different++;
    out.set(hit ? [255, 0, 0, 255] : [200, 200, 200, 255], o);
  }

  const diffPngBytes = different > 0 ? await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer() : null;
  return { sizeMismatch: false, diffRatio: different / (width * height), diffPng: diffPngBytes };
}
