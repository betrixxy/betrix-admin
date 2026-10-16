import { colorName } from "@/lib/services/fal/match-day-prompts";
import type { MatchImportance } from "@/types/match-result";

/**
 * "Maç Sonucu" prompt blokları (bkz. CLAUDE.md 3.2.1, 5.4) — Maç Günü ile aynı kurallar: gerçek
 * spor fotoğrafçılığı, hex yerine renk adı, istenmeyen kavram anılmaz, sahnede insan figürü yok
 * (oyuncular ayrı katman). Arka plan maçın sonucuna göre iki duygudan birini taşır: galibiyet
 * (sıcak, kutlama) ya da beraberlik (dengeli, sakin). Maç önemi atmosferin yoğunluğunu belirler.
 */

export type ResultMood = "WIN" | "DRAW";

export interface MatchResultPromptInput {
  mood: ResultMood;
  importance: MatchImportance;
  /** Kazananın (beraberlikte ev sahibinin) ve rakibin forma rengi — `#rrggbb`. */
  primaryColorHex: string;
  secondaryColorHex: string;
  customPrompt?: string | undefined;
}

const PHOTO_STYLE =
  "realistic sports photography, shot on a full-frame DSLR, natural colors, true-to-life lighting, fine film grain, high dynamic range";

/** Sahne: düdükten sonraki stadyum — sonuca göre ışık ve tribün hali. */
export function buildResultSceneBlock(mood: ResultMood, primary: string, secondary: string): string {
  return mood === "WIN"
    ? `football stadium at night just after the final whistle, view from pitch level toward the stands, ` +
        `warm golden floodlights, fans in ${primary} celebrating in the blurred stands, scarves raised`
    : `football stadium at night just after the final whistle, view from pitch level toward the stands, ` +
        `even neutral floodlights, fans in ${primary} and ${secondary} colors in the blurred stands, calm and balanced mood`;
}

/** Maç önemi → tribün yoğunluğu (gerçek stadyum olgularıyla, efektle değil). */
const IMPORTANCE_BLOCK: Record<MatchImportance, string> = {
  NORMAL: "regular match night, stands well filled",
  DERBY: "derby night, sold-out stands waving scarves and flags",
  BIG_DERBY: "huge derby occasion, sold-out stadium with a giant fan choreography in the stands, light flare smoke in the distance",
  FINAL_CRITICAL: "decisive high-stakes night, packed stadium, floodlight beams through light haze",
};

export function buildImportanceBlock(importance: MatchImportance): string {
  return IMPORTANCE_BLOCK[importance];
}

/** Kompozisyon: oyuncu ortada, alt üçte bir koyu (skor ve golcüler oraya basılır). */
export const RESULT_COMPOSITION_BLOCK =
  "shallow depth of field, empty pitch in the foreground, darker lower third of the frame, no people in the foreground, no text";

function withCustom(base: string, customPrompt: string | undefined): string {
  return customPrompt ? `${base}. Additional direction: ${customPrompt}` : base;
}

/** Flux text-to-image: galibiyet ya da beraberlik arka planı. */
export function buildMatchResultBackgroundPrompt(input: MatchResultPromptInput): string {
  const scene = buildResultSceneBlock(input.mood, colorName(input.primaryColorHex), colorName(input.secondaryColorHex));
  return withCustom(`${scene}, ${buildImportanceBlock(input.importance)}, ${RESULT_COMPOSITION_BLOCK}, ${PHOTO_STYLE}`, input.customPrompt);
}

/**
 * Galibiyet eki — oyuncu düzenlemesinde ışık sıcaklaşır, omuz çevresinde hafif ışık partikülleri
 * belirir; yüz ve ifade aynen korunur. Beraberlikte eklenmez (dengeli, nötr ışık).
 */
export const VICTORY_EDIT_BLOCK =
  "warmer golden key light on the player, a few soft glowing light particles drifting around the shoulders, " +
  "face, identity and facial expression exactly unchanged";

/** Flux image-to-image: kompoziti tek fotoğraf gibi birleştirir; galibiyette sıcak kutlama ışığı. */
export function buildMatchResultHarmonizePrompt(input: MatchResultPromptInput): string {
  const base =
    input.mood === "WIN"
      ? "post-match celebration photograph of a football player in a stadium at night"
      : "post-match photograph of football players in a stadium at night, neutral balanced lighting";
  const parts = [base, input.mood === "WIN" ? VICTORY_EDIT_BLOCK : null, "consistent floodlight lighting on the players", "natural skin tones, realistic shadows, sharp focus on faces and kits", PHOTO_STYLE];
  return withCustom(parts.filter(Boolean).join(", "), input.customPrompt);
}
