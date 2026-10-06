import { colorName } from "@/lib/services/fal/match-day-prompts";

/**
 * Derinlemesine Analiz kartının kapak sahnesi — tek takım, tek oyuncu (kesim ayrı katman). Maç Günü
 * prompt kurallarıyla aynı (bkz. match-day-prompts.ts): istenmeyen kavram anılmaz, hex yazılmaz,
 * sahnede insan figürü yoktur; sol tarafta başlık için sakin, karanlık alan bırakılır.
 */
const PHOTO_STYLE =
  "realistic sports photography, shot on a full-frame DSLR, natural colors, true-to-life lighting, fine film grain, high dynamic range";

export function buildAnalysisHeroPrompt(colorHex: string): string {
  const color = colorName(colorHex);
  return [
    "empty professional football stadium at night seen from pitch level near the touchline, wide angle",
    `floodlights casting a cool white glow, stands softly lit in ${color} tones with ${color} scarves and flags in the crowd, out of focus`,
    "light mist above the grass, deep shadows, moody editorial look",
    "calm dark empty area on the left third of the frame, subject space on the right",
    PHOTO_STYLE,
  ].join(", ");
}
