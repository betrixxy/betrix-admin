import type { MatchDayTemplateId } from "@/types/match-day";
import type { DerbyIntensity } from "@/types/sports";

/**
 * "Maç Günü" prompt blokları (bkz. CLAUDE.md 3.2.1, 5.4). Hedef: gerçek spor fotoğrafçılığı —
 * belgesel/yayın kalitesinde stadyum ve stüdyo sahneleri.
 *
 * Halüsinasyon önleme kuralları:
 * - İstenmeyen kavramlar (lazer, neon, bilim kurgu…) prompt'ta HİÇ anılmaz; "no X" yazmak bile
 *   difüzyon modeline X'i çağrıştırır. Sahne yalnızca olumlu, fotoğrafçılık terimleriyle tarif edilir.
 * - Hex kodu yazılmaz (model bunları anlamsız ışık/metin olarak yorumlayabilir); takım renkleri
 *   en yakın sade renk adına çevrilir ve yalnızca "taraftar atkısı/ışık sıcaklığı" gibi gerçekçi
 *   bağlamlarda geçer.
 * - Arka plan sahnesi insan figürü içermez; oyuncular ayrı katmandır (birefnet).
 */

const COLOR_NAMES: [string, [number, number, number]][] = [
  ["red", [200, 16, 46]],
  ["dark red", [123, 30, 46]],
  ["orange", [249, 115, 22]],
  ["yellow", [250, 204, 21]],
  ["green", [22, 163, 74]],
  ["dark green", [20, 83, 45]],
  ["sky blue", [56, 189, 248]],
  ["blue", [29, 78, 216]],
  ["navy", [30, 58, 138]],
  ["purple", [124, 58, 237]],
  ["black", [17, 17, 17]],
  ["white", [245, 245, 245]],
  ["grey", [107, 114, 128]],
];

/** "#1d4ed8" → "blue": prompt'a hex yerine sade renk adı yazılır. */
export function colorName(hex: string): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  let best = "white";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, [r, g, b]] of COLOR_NAMES) {
    const distance = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

/** Derbi tansiyonu gerçek stadyum olgularıyla anlatılır (koreografi, meşale dumanı), efektle değil. */
const ATMOSPHERE: Record<DerbyIntensity, string> = {
  NONE: "calm evening match atmosphere, stands filling up",
  RIVALRY: "tense competitive evening, packed stands",
  DERBY: "electric derby night, sold-out stands waving scarves and flags, light flare smoke drifting in the distance",
  ELITE_DERBY: "huge occasion, sold-out stadium with a giant fan choreography in the stands, light flare smoke in the distance",
};

const PHOTO_STYLE =
  "realistic sports photography, shot on a full-frame DSLR, natural colors, true-to-life lighting, fine film grain, high dynamic range";

export interface MatchDayPromptInput {
  template: MatchDayTemplateId;
  homeColorHex: string;
  awayColorHex: string;
  derbyIntensity: DerbyIntensity;
  customPrompt?: string | undefined;
}

interface ArtDirection {
  scene: (home: string, away: string, mood: string) => string;
  harmonize: string;
}

const ART_DIRECTION: Record<MatchDayTemplateId, ArtDirection> = {
  PREMIUM_BROADCAST: {
    scene: (home, away, mood) =>
      `empty football pitch inside a large modern stadium at night, view from the touchline toward the main stand, ` +
      `bright white floodlights, ${mood}, fans in ${home} and ${away} colors in the blurred stands, ` +
      `shallow depth of field, broadcast pre-match photography, darker sky and stand roof at the top of the frame`,
    harmonize:
      "pre-match broadcast photograph of two football players in a stadium at night, consistent floodlight lighting on the players, matching color temperature between players and background",
  },
  DATA_DRIVEN: {
    // Bu şablon AI arka plan kullanmaz (programatik zemin); yine de tutarlılık için tanımlı.
    scene: () => "dark neutral studio backdrop, even soft light",
    harmonize: "clean studio photograph of two football players on a dark neutral backdrop",
  },
  EDITORIAL_PORTRAIT: {
    scene: () =>
      "professional sports magazine photoshoot backdrop, dark charcoal seamless paper background, single large softbox key light from above, " +
      "soft gradient falloff to black at the edges, subtle haze, empty set",
    harmonize:
      "sports magazine cover portrait of two football players, dramatic studio key light, soft shadows, natural skin tones, editorial photography",
  },
};

function withCustom(base: string, customPrompt: string | undefined): string {
  return customPrompt ? `${base}. Additional direction: ${customPrompt}` : base;
}

/** Flux text-to-image: şablonun sahnesi, gerçek fotoğraf dili, insan figürsüz. */
export function buildMatchDayBackgroundPrompt(input: MatchDayPromptInput): string {
  const art = ART_DIRECTION[input.template];
  const scene = art.scene(colorName(input.homeColorHex), colorName(input.awayColorHex), ATMOSPHERE[input.derbyIntensity]);
  return withCustom(`${scene}, ${PHOTO_STYLE}, no people in the foreground, no text`, input.customPrompt);
}

/**
 * Flux image-to-image: kaba kompozitin ışığını, renk sıcaklığını ve kenar geçişlerini tek bir
 * gerçek fotoğraf gibi birleştirir. Düşük `strength` kompozisyonu ve yüzleri korur.
 */
export function buildMatchDayHarmonizePrompt(input: MatchDayPromptInput): string {
  return withCustom(
    `${ART_DIRECTION[input.template].harmonize}, natural skin tones, realistic shadows, sharp focus on faces and kits, ${PHOTO_STYLE}`,
    input.customPrompt,
  );
}
