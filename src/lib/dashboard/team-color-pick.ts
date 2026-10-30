import { isHex, isSimilarColor, liftLightness } from "@/lib/dashboard/color-math";
import { MONOCHROME_SHARE } from "@/lib/dashboard/lineup-palette";
import type { LogoSwatches } from "@/types/lineup";

/**
 * Tablo dışı takımın rengi logodan (saf): baskın swatch'lar sırayla (canlı → koyu canlı → soluk → koyu soluk →
 * açık), koyu zeminde okunurluk kuralıyla (`liftLightness`: ton korunur, yalnızca açıklık yükselir; okunmayan
 * aday atlanır). Siyah-beyaz arma (renkli piksel < %25) → beyaz / siyah. İkincil: birincile benzemeyen ilk
 * aday, yoksa beyaz. Hiç okunur aday yoksa null — kart nötr beyaz çizer.
 */
export function logoTeamColors(swatches: LogoSwatches | null): { primary: string; secondary: string } | null {
  if (!swatches) return null;
  if (swatches.chromaticShare < MONOCHROME_SHARE) return { primary: "#FFFFFF", secondary: "#000000" };
  const candidates = [swatches.vibrant, swatches.darkVibrant, swatches.muted, swatches.darkMuted, swatches.lightVibrant, swatches.lightMuted].filter(isHex).map((hex) => hex.toUpperCase());
  const primary = candidates.find((hex) => liftLightness(hex) !== null);
  if (!primary) return null;
  const secondary = candidates.find((hex) => hex !== primary && !isSimilarColor(hex, primary)) ?? "#FFFFFF";
  return { primary, secondary };
}
