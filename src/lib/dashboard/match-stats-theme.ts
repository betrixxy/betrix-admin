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
