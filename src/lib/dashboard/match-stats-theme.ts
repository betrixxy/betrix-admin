import { readableOnDark } from "@/lib/dashboard/match-result-theme";
import type { MatchStatsFacts } from "@/types/match-stats";

/**
 * Maç İstatistikleri iki takım rengi — saf. Her renk Maç Sonucu'nun kontrast korumasından geçer
 * (koyu zeminde okunana kadar beyaza açılır). İki renk aynı/benzerse deplasman önce ikincil
 * renge, o da benzerse nötr gümüşe, gümüş de ev sahibine benziyorsa (beyaz forma) altına düşer.
 */

/** API forma rengi vermediğinde ya da ikincil renk gerektiğinde — API-Football takım id → renk. */
const TEAM_SECONDARY: Record<number, string> = {
  645: "#FDB912", // Galatasaray sarı
  611: "#FFED00", // Fenerbahçe sarı
  549: "#FFFFFF", // Beşiktaş beyaz
  998: "#5AB4E5", // Trabzonspor mavi
  564: "#163962", // Başakşehir lacivert
  397: "#D3122A", // Midtjylland kırmızı
};

export const NEUTRAL_SILVER = "#C9CED6";
const NEUTRAL_GOLD = "#F5C518";
const FALLBACK_HOME = "#F5C518";
const FALLBACK_AWAY = "#C9CED6";
/** "redmean" RGB uzaklığı bu eşiğin altındaysa iki renk kartta ayırt edilemez sayılır. */
const SIMILAR_DISTANCE = 120;

const isHex = (value: string | undefined): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value);

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Algısal yaklaşık renk uzaklığı (0 = aynı, ~765 = siyah/beyaz). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  const mean = (r1 + r2) / 2;
  const [dr, dg, db] = [r1 - r2, g1 - g2, b1 - b2];
  return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db);
}

export const isSimilarColor = (a: string, b: string) => colorDistance(a, b) < SIMILAR_DISTANCE;

/** Geride kalan tarafın açıklığı, önde olanınkinin bu oranına çekilir (HSL L × 0,55). */
const TRAIL_LIGHTNESS = 0.55;
/** Koyulaşan renk griye/kahverengiye kaymasın diye doygunluk en az bu kadar artırılır. */
const TRAIL_SATURATION_BOOST = 1.15;

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
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
  return `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Geride kalan tarafın çubuk rengi: opaklık yerine aynı tonun koyulaştırılmış, doygun hâli
 * (L × 0,55, S × 1,15). Ton (H) korunur — kırmızı bordoya, mavi laciverte iner, kahverengiye
 * kaymaz; renksiz (beyaz) forma griye iner.
 */
export function trailHex(hex: string): string {
  const [h, s, l] = toHsl(hex);
  return fromHsl(h, Math.min(1, s * TRAIL_SATURATION_BOOST), l * TRAIL_LIGHTNESS);
}

/**
 * Koyu zeminde griye açılan renksiz forma (siyah, antrasit): kartta nötr gümüş satırlarla
 * karışır — takımın ikincil rengi biliniyorsa o kullanılır. Beyaz forma bu kapsamda değildir.
 */
function isMutedGray(hex: string): boolean {
  const [r, g, b] = channels(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 24 && Math.max(r, g, b) < 200;
}

/** Takımın kartta okunur rengi: forma rengi, gri kalıyorsa ikincil renk. */
function teamHex(team: MatchStatsFacts["home"], fallback: string): string[] {
  const primary = readableOnDark(isHex(team.colorHex) ? team.colorHex : fallback);
  const secondary = TEAM_SECONDARY[team.id];
  const secondaryHex = isHex(secondary) ? readableOnDark(secondary) : null;
  if (secondaryHex && isMutedGray(primary)) return [secondaryHex, primary];
  return secondaryHex ? [primary, secondaryHex] : [primary];
}

export function statsPalette(facts: Pick<MatchStatsFacts, "home" | "away">): { homeHex: string; awayHex: string } {
  const homeHex = teamHex(facts.home, FALLBACK_HOME)[0] ?? readableOnDark(FALLBACK_HOME);
  const candidates = [...teamHex(facts.away, FALLBACK_AWAY), readableOnDark(NEUTRAL_SILVER), readableOnDark(NEUTRAL_GOLD)];
  const awayHex = candidates.find((hex) => !isSimilarColor(hex, homeHex)) ?? NEUTRAL_GOLD;
  return { homeHex, awayHex };
}
