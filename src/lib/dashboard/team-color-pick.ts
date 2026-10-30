import { isHex, isReadableOnCard, isSimilarColor, liftLightness, MAX_LIFT_LIGHTNESS, toHsl } from "@/lib/dashboard/color-math";
import { MONOCHROME_SHARE } from "@/lib/dashboard/lineup-palette";
import type { LogoSwatches, LogoSwatchName } from "@/types/lineup";

/**
 * Tablo dışı takımın rengi logodan (saf): baskın swatch'lar, koyu zeminde okunurluk kuralıyla (`liftLightness`:
 * ton korunur, yalnızca açıklık yükselir; okunmayan aday atlanır). Siyah-beyaz arma (renkli piksel < %25) →
 * beyaz / siyah. İkincil: birincile benzemeyen ilk aday, yoksa beyaz. Hiç okunur aday yoksa null — kart nötr
 * beyaz çizer.
 *
 * Sıra (2026-10-31): swatch nüfusu (logodaki alan) biliniyorsa ALAN × doygunluk ağırlığıyla — küçük ama çok
 * doygun detay baskın rengi geçemez (Fiorentina: mor alan ≈ 2500 piksel, kırmızı zambak ≈ 750 → mor). En büyük
 * adayın `MIN_AREA_SHARE`'inden küçük swatch (gürültü) aday sayılmaz. Nüfus yoksa eski sabit sıra (canlı → koyu
 * canlı → soluk → koyu soluk → açık).
 *
 * Baskın aday koyu zeminde olduğu gibi okunmuyorsa önce AYNI renk ailesinden (`isSimilarColor`) olduğu gibi okunan,
 * pastel olmayan (L ≤ `MAX_LIFT_LIGHTNESS`) bir swatch aranır — logonun koyu laciverti yerine aynı mavinin canlı
 * tonu (Napoli); yoksa adayın açıklığı yükseltilerek okunuyorsa aday; hiçbiri yoksa sıradaki aday. Ağırlıklı sırada
 * hiç okunur aday kalmazsa eski sabit sıraya düşülür (Inter: koyu mavi + siyah → açık mavi).
 */

const ORDER: readonly LogoSwatchName[] = ["vibrant", "darkVibrant", "muted", "darkMuted", "lightVibrant", "lightMuted"];
/** Ağırlık = alan × (taban + doygunluk): doygunluk rengi öne alır ama alanı ezmez. */
const SATURATION_BASE = 0.35;
/** En büyük swatch alanının bu oranından küçük swatch (birkaç piksellik detay) aday olmaz. */
const MIN_AREA_SHARE = 0.05;

interface Candidate {
  hex: string;
  /** Swatch nüfusu; bilinmiyorsa null. */
  area: number | null;
  weight: number;
}

function weighted(swatches: LogoSwatches): string[] {
  const all = ORDER.flatMap((name): Candidate[] => {
    const hex = swatches[name];
    if (!isHex(hex)) return [];
    const area = swatches.populations?.[name] ?? null;
    return [{ hex: hex.toUpperCase(), area, weight: area === null ? 0 : area * (SATURATION_BASE + toHsl(hex)[1]) }];
  });
  // Nüfus yoksa (eski girdi) sabit sıra.
  if (all.some((candidate) => candidate.area === null)) return all.map((candidate) => candidate.hex);
  const largest = Math.max(0, ...all.map((candidate) => candidate.area ?? 0));
  return all
    .filter((candidate) => (candidate.area ?? 0) >= largest * MIN_AREA_SHARE)
    .sort((a, b) => b.weight - a.weight)
    .map((candidate) => candidate.hex);
}

export function logoTeamColors(swatches: LogoSwatches | null): { primary: string; secondary: string } | null {
  if (!swatches) return null;
  if (swatches.chromaticShare < MONOCHROME_SHARE) return { primary: "#FFFFFF", secondary: "#000000" };
  const legacy = ORDER.map((name) => swatches[name]).filter(isHex).map((hex) => hex.toUpperCase());
  const ordered = weighted(swatches);
  const vivid = legacy.filter((hex) => isReadableOnCard(hex) && toHsl(hex)[2] <= MAX_LIFT_LIGHTNESS + 1e-9);
  const pick = (hex: string) => (isReadableOnCard(hex) ? hex : (vivid.find((other) => isSimilarColor(other, hex)) ?? (liftLightness(hex) ? hex : null)));
  const primary = ordered.map(pick).find((hex): hex is string => hex !== null) ?? legacy.find((hex) => liftLightness(hex) !== null);
  if (!primary) return null;
  const secondary = ordered.find((hex) => hex !== primary && !isSimilarColor(hex, primary)) ?? "#FFFFFF";
  return { primary, secondary };
}
