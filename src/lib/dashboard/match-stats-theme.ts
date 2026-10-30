import { fromHsl, isSimilarColor, liftLightness, toHsl } from "@/lib/dashboard/color-math";
import { readableTeamColors } from "@/lib/dashboard/match-result-theme";
import type { MatchStatsFacts } from "@/types/match-stats";

export { colorDistance, isSimilarColor } from "@/lib/dashboard/color-math";

/**
 * Maç İstatistikleri iki takım rengi — saf. Maç Sonucu vurgusuyla AYNI kural (`color-math.ts`):
 * renk tonu korunarak açılır (beyaza karıştırılmaz); okunmuyorsa (siyah forma, koyu lacivert)
 * ikincil renge geçilir. İki renk benzerse (RGB'de yakın ya da aynı ton ailesi — iki kırmızı)
 * deplasman önce ikincil renge, o da benzerse nötr gümüşe, gümüş de ev sahibine benziyorsa
 * (beyaz forma) altına düşer.
 */

export const NEUTRAL_SILVER = "#C9CED6";
/** İkinci nötr (ev sahibi de nötrse) — altın değil (kurucu kararı 2026-10-30). */
const NEUTRAL_SLATE = "#9AA3B5";

/** Geride kalan tarafın açıklığı, önde olanınkinin bu oranına çekilir (HSL L × 0,55). */
const TRAIL_LIGHTNESS = 0.55;
/** Koyulaşan renk griye/kahverengiye kaymasın diye doygunluk en az bu kadar artırılır. */
const TRAIL_SATURATION_BOOST = 1.15;
/** Sarı (≈40°-75°) koyulaşınca zeytin/kahverengiye döner — daha az koyulaştırılır (koyu hardal). */
const TRAIL_LIGHTNESS_YELLOW = 0.72;
const isYellowHue = (h: number) => h * 360 >= 40 && h * 360 <= 75;

/**
 * Geride kalan tarafın çubuk rengi: opaklık yerine aynı tonun koyulaştırılmış, doygun hâli
 * (L × 0,55, S × 1,15). Ton (H) korunur — kırmızı bordoya, mavi laciverte iner, kahverengiye
 * kaymaz; renksiz (beyaz) forma griye iner.
 */
export function trailHex(hex: string): string {
  const [h, s, l] = toHsl(hex);
  const factor = isYellowHue(h) ? TRAIL_LIGHTNESS_YELLOW : TRAIL_LIGHTNESS;
  return fromHsl(h, Math.min(1, s * TRAIL_SATURATION_BOOST), l * factor);
}

const neutral = (hex: string) => liftLightness(hex) ?? hex.toLowerCase();

export function statsPalette(facts: Pick<MatchStatsFacts, "home" | "away">): { homeHex: string; awayHex: string } {
  const homeHex = readableTeamColors(facts.home)[0] ?? neutral(NEUTRAL_SILVER);
  const candidates = [...readableTeamColors(facts.away), neutral(NEUTRAL_SILVER), neutral(NEUTRAL_SLATE)];
  const awayHex = candidates.find((hex) => !isSimilarColor(hex, homeHex)) ?? neutral(NEUTRAL_SLATE);
  return { homeHex, awayHex };
}
