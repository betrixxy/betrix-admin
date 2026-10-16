import type { CompetitionKind, MatchResultFacts } from "@/types/match-result";

/**
 * Maç Sonucu tek vurgu rengi: Avrupa turnuvasında turnuva rengi, yurt içinde kazanan takımın
 * forma rengi (beraberlikte ev sahibi). Vurgu koyu gradyanın üstüne yazılır; okunmuyorsa
 * (siyah forma, lacivert) kontrast eşiğine kadar beyaza doğru açılır.
 */

/** Turnuva kimlik renkleri: `accent` yazı/çizgi vurgusu, `deep` çerçeve/zemin tonu. */
export const COMPETITION_COLORS: Partial<Record<CompetitionKind, { accent: string; deep: string }>> = {
  UCL: { accent: "#C8D2E0", deep: "#0B1F4F" }, // lacivert / gümüş
  UEL: { accent: "#FF6B00", deep: "#2B1300" }, // turuncu
  UECL: { accent: "#00C25A", deep: "#06291A" }, // yeşil
};

/** Dizilişte forma rengi gelmezse — API-Football takım id → ana renk. */
const TEAM_COLORS: Record<number, string> = {
  645: "#A90432", // Galatasaray
  611: "#163962", // Fenerbahçe
  549: "#111111", // Beşiktaş
  998: "#7A1E3A", // Trabzonspor
  564: "#E2672A", // Başakşehir
  777: "#E30A17", // Türkiye
};

const FALLBACK_ACCENT = "#F5C518";
/** Kartın koyu gradyan zemini — kontrast bu renge göre ölçülür. */
export const RESULT_SHADE_HEX = "#07080C";
const MIN_CONTRAST = 4.5;

export function teamColorHex(teamId: number): string {
  return TEAM_COLORS[teamId] ?? "";
}

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rengi, koyu zeminde `MIN_CONTRAST`'a ulaşana kadar beyaza doğru karıştırır (tonu korunur). */
export function readableOnDark(hex: string, background = RESULT_SHADE_HEX): string {
  const base = channels(hex);
  for (let t = 0; t <= 1; t += 0.05) {
    const mixed = toHex(base.map((c) => c + (255 - c) * t) as [number, number, number]);
    if (contrastRatio(mixed, background) >= MIN_CONTRAST) return mixed;
  }
  return "#FFFFFF";
}

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export function resultAccentHex(facts: Pick<MatchResultFacts, "competition" | "outcome" | "home" | "away">): string {
  const competition = COMPETITION_COLORS[facts.competition.kind];
  if (competition) return competition.accent;
  const team = facts.outcome === "AWAY" ? facts.away : facts.home;
  return readableOnDark(isHex(team.colorHex) ? team.colorHex : FALLBACK_ACCENT);
}
