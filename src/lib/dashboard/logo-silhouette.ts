import sharp from "sharp";

/**
 * Turnuva rozeti için logo → beyaz siluet (saf piksel işlemleri + sharp). Set rozeti şeffaf olduğu
 * için logo tek renk beyaz çizilir (yayın grafiğindeki gibi). Sıra:
 *   1. Logonun kendi alfa kanalı yeterince şeffafsa → doğrudan siluet.
 *   2. Düz zeminliyse (JPEG, beyaz kutulu PNG) → kenardan taşma doldurmayla zemin temizlenir → siluet.
 *   3. Zemin düz değilse (fotoğraf, degrade) → null: rozet çizilmez, beyaz kutu asla çıkmaz.
 */

/** Şeffaf alanı bundan azsa logo düz zeminli sayılır. */
export const MIN_TRANSPARENT_SHARE = 0.1;
/** Dört köşe birbirine bu kadar yakınsa (RGB öklid) zemin düzdür. */
const CORNER_TOLERANCE = 28;
/** Zeminden bu uzaklığa kadar piksel tamamen silinir; `SOFT_EDGE` kadar daha yumuşak geçiş. */
const HARD_EDGE = 30;
const SOFT_EDGE = 36;
/** Temizlikten sonra en az bu kadar ön plan kalmalı (yoksa her şey zemin sanılmıştır). */
const MIN_FOREGROUND_SHARE = 0.03;

export interface RgbaImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const OPAQUE = 16;

export function transparentShare(alpha: Uint8Array): number {
  let count = 0;
  for (const value of alpha) if (value < OPAQUE) count++;
  return alpha.length === 0 ? 0 : count / alpha.length;
}

function distance(data: Uint8Array, offset: number, rgb: [number, number, number]): number {
  return Math.hypot((data[offset] ?? 0) - rgb[0], (data[offset + 1] ?? 0) - rgb[1], (data[offset + 2] ?? 0) - rgb[2]);
}

/**
 * Düz zemini kenardan taşma doldurmayla siler, yeni alfa kanalını döndürür. Köşeler aynı renkte
 * değilse ya da temizlik sonrası ön plan kalmıyorsa null. İç bölgedeki zemin rengi (kenara
 * bağlanmayan) korunur — logonun içindeki beyaz alanlar silinmez.
 */
export function flatBackgroundAlpha({ data, width, height }: RgbaImage): Uint8Array | null {
  if (width < 2 || height < 2) return null;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const background = [0, 1, 2].map((c) => corners.reduce((sum, o) => sum + (data[o + c] ?? 0), 0) / corners.length) as [number, number, number];
  if (corners.some((offset) => distance(data, offset, background) > CORNER_TOLERANCE)) return null;

  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] ?? 255;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const d = distance(data, index * 4, background);
    if (d >= HARD_EDGE + SOFT_EDGE) continue;
    const ramp = Math.max(0, (d - HARD_EDGE) / SOFT_EDGE);
    alpha[index] = Math.min(alpha[index] ?? 255, Math.round(ramp * 255));
    if (d >= HARD_EDGE) continue; // geçiş pikseli: kenar yumuşar ama dolgu ön plana sızmaz
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  const cleared = transparentShare(alpha);
  if (cleared < MIN_TRANSPARENT_SHARE || 1 - cleared < MIN_FOREGROUND_SHARE) return null;
  return alpha;
}

async function whiteSilhouette(alpha: Uint8Array, width: number, height: number): Promise<string> {
  const white = await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(Buffer.from(alpha), { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${white.toString("base64")}`;
}

/** Logo baytları → beyaz siluet `data:` URI; düz zemini temizlenemeyen logoda null (rozetsiz). */
export async function logoSilhouette(bytes: Buffer): Promise<string | null> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image: RgbaImage = { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
  const ownAlpha = new Uint8Array(image.width * image.height);
  for (let i = 0; i < ownAlpha.length; i++) ownAlpha[i] = image.data[i * 4 + 3] ?? 255;

  const alpha = transparentShare(ownAlpha) >= MIN_TRANSPARENT_SHARE ? ownAlpha : flatBackgroundAlpha(image);
  return alpha ? whiteSilhouette(alpha, image.width, image.height) : null;
}
