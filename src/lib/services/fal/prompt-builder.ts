import type { DerbyIntensity, Fixture } from "@/types/sports";

/** Bkz. CLAUDE.md 3.2.3 — derbi tansiyonu kademeleri ve mood/atmosfer prompt ekleri. */
const MOOD_BY_DERBY_INTENSITY: Record<DerbyIntensity, string> = {
  NONE: "calm professional match night, balanced neutral lighting",
  RIVALRY: "tense competitive atmosphere, sharp contrast lighting, charged energy",
  DERBY:
    "electric neon-accented rivalry atmosphere, pulsing crowd energy implied through light patterns, high saturation team-color neon glow",
  ELITE_DERBY:
    "apocalyptic high-stakes cinematic atmosphere, extreme dramatic lighting, smoke and light beams, maximum tension, blockbuster movie poster energy",
};

/** Bkz. CLAUDE.md 3.2.1 — sabit negatif prompt, her çağrıda değişmeden eklenir. */
const NEGATIVE_PROMPT =
  "no human figures, no faces, no visible sponsor logos, no readable text, no watermarks, no blurry crowd close-ups, no oversaturation, no cartoonish style";

function isSameHex(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * İki takım aynı ana rengi taşıyorsa deplasman rengini kanal döndürerek ayrıştırır
 * (bkz. CLAUDE.md 3.2.2). Veri modelinde henüz ayrı bir `secondaryColorHex` alanı
 * bulunmadığından bu, tam teşekküllü çözümün basitleştirilmiş bir yaklaşımıdır.
 */
function resolveAwayColor(homeHex: string, awayHex: string): string {
  if (!isSameHex(homeHex, awayHex)) return awayHex;
  const hex = awayHex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#1d4ed8";
  const [r, g, b] = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
  return `#${b}${g}${r}`;
}

export interface StadiumPromptInput {
  fixture: Fixture;
  /** Kullanıcının stüdyo formunda yazdığı ek yönerge — bkz. CLAUDE.md 3.2.1 blok yapısına eklenir. */
  customPrompt?: string;
}

/**
 * CLAUDE.md 3.2.1'deki zorunlu 6 blok yapısını (subject, lighting, color grade, mood,
 * camera, negative prompt) sırasıyla birleştirip nihai Flux prompt'unu üretir.
 */
export function buildStadiumPrompt({ fixture, customPrompt }: StadiumPromptInput): string {
  const home = fixture.homeTeam;
  const away = fixture.awayTeam;
  const awayColor = resolveAwayColor(home.primaryColorHex, away.primaryColorHex);

  const subject =
    "empty professional football stadium interior, wide bowl, floodlights, night match atmosphere";
  const lighting = `dramatic rim lighting from floodlights blending ${home.primaryColorHex} and ${awayColor}, volumetric light shafts cutting through stadium mist`;
  const colorGrade = `cinematic color grade blending ${home.primaryColorHex} and ${awayColor}, deep shadows, high contrast teal-and-orange base with team accent overrides`;
  const mood = MOOD_BY_DERBY_INTENSITY[fixture.derbyIntensity];
  const camera =
    "low-angle wide shot, shallow depth of field, negative space in lower-third and left third for typography overlay";

  const base = [subject, lighting, colorGrade, mood, camera, NEGATIVE_PROMPT].join(", ");
  return customPrompt ? `${base}. Ek yönerge: ${customPrompt}` : base;
}
