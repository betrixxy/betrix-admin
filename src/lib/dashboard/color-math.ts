/**
 * Kart renk matematiği — saf. Maç Sonucu vurgusu ve Maç İstatistikleri takım renkleri AYNI kuralı
 * kullanır (bkz. `match-result-theme.ts`, `match-stats-theme.ts`):
 *
 *   - Okunurluk: renk beyaza KARIŞTIRILMAZ (kırmızı → pembe olurdu). HSL'de ton (H) ve doygunluk
 *     (S) korunur, yalnızca açıklık (L) `MAX_LIFT_LIGHTNESS`'e kadar yükseltilir; kontrast yine
 *     yetmiyorsa renk "okunamaz" sayılır (null) ve çağıran ikincil renge geçer.
 *   - Benzerlik: RGB uzaklığına ek olarak ton farkı da bakılır — iki doygun kırmızı (Galatasaray
 *     #A90432 / Gençlerbirliği #E30613) uzaklıkça ayrı görünse de kartta ayırt edilemez.
 */

export type Rgb = [number, number, number];

export function channels(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

export const isHex = (value: string | null | undefined): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value);

/** HSL (0..1). */
export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((c) => c / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

export function fromHsl(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = s === 0 ? [l, l, l] : [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  return toHex(rgb.map((c) => c * 255) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Kartın koyu gradyan zemini — kontrast bu renge göre ölçülür. */
export const CARD_SHADE_HEX = "#07080C";
export const MIN_CONTRAST = 4.5;
/**
 * Açıklık bunun üstüne çıkarılmaz: doygun kırmızı L≈0,62'den sonra mercana/pembeye, lacivert
 * pastel maviye döner — renk kimliği kaybolur. Bu sınırda okunmayan renk ikincile bırakılır.
 */
export const MAX_LIFT_LIGHTNESS = 0.62;
/** Bu doygunluğun altı renksiz (siyah/gri/beyaz): açıklığı yükseltmek griden başka bir şey üretmez. */
const ACHROMATIC_SATURATION = 0.12;

/**
 * Koyu zeminde okunur hâl: zaten okunuyorsa aynısı; değilse H ve S korunup L adım adım
 * yükseltilir. Renksiz koyu renk (siyah, antrasit) ya da sınırda da okunmayan renk → null.
 */
export function liftLightness(hex: string, background = CARD_SHADE_HEX): string | null {
  const normalized = hex.toLowerCase();
  if (contrastRatio(normalized, background) >= MIN_CONTRAST) return normalized;
  const [h, s, l] = toHsl(normalized);
  if (s < ACHROMATIC_SATURATION) return null;
  for (let lightness = l + 0.01; lightness <= MAX_LIFT_LIGHTNESS + 1e-9; lightness += 0.01) {
    const lifted = fromHsl(h, s, lightness);
    if (contrastRatio(lifted, background) >= MIN_CONTRAST) return lifted;
  }
  return null;
}

/** Sırayla ilk okunur aday (ör. birincil → ikincil); hiçbiri değilse null. */
export function firstReadable(candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!isHex(candidate)) continue;
    const lifted = liftLightness(candidate);
    if (lifted) return lifted;
  }
  return null;
}

/** "redmean" RGB uzaklığı (0 = aynı, ~765 = siyah/beyaz). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  const mean = (r1 + r2) / 2;
  const [dr, dg, db] = [r1 - r2, g1 - g2, b1 - b2];
  return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db);
}

const SIMILAR_DISTANCE = 120;
/** İki doygun renk arasındaki ton farkı bundan azsa (derece) aynı renk ailesidir. */
const SIMILAR_HUE_DEGREES = 28;
const CHROMATIC_SATURATION = 0.3;

/** Ton farkı, çember üzerinde (0..180°). */
export function hueDifference(a: string, b: string): number {
  const diff = Math.abs(toHsl(a)[0] - toHsl(b)[0]) * 360;
  return Math.min(diff, 360 - diff);
}

/** Kartta ayırt edilemez mi: RGB'de yakın YA DA ikisi de doygun ve aynı ton ailesinde. */
export function isSimilarColor(a: string, b: string): boolean {
  if (colorDistance(a, b) < SIMILAR_DISTANCE) return true;
  const chromatic = toHsl(a)[1] >= CHROMATIC_SATURATION && toHsl(b)[1] >= CHROMATIC_SATURATION;
  return chromatic && hueDifference(a, b) < SIMILAR_HUE_DEGREES;
}
