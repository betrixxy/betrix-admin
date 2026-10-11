import type { SupportedLeagueId } from "@/lib/services/api-football/leagues";

/**
 * "Haftanın Maçları" temaları. Yerel ligler ferah/kurumsal açık zemin (lig rengi vurgu), Avrupa kupaları
 * karakteristik gece zemini + neon vurgu. Açık temada CheckMatch logosu (açık gri) okunsun diye imza
 * koyu bir alt bantta durur.
 */

export interface WeeklyTheme {
  mode: "light" | "night";
  background: string;
  /** Gece temasında üstte neon parıltı; açık temada yok. */
  glow: string | null;
  text: string;
  muted: string;
  accent: string;
  /** Maç satırı kutusu. */
  row: string;
  rowBorder: string;
  /** Skor kutusu (dolu) ve saat kutusu (çerçeveli). */
  scoreBg: string;
  scoreText: string;
  timeBg: string;
  timeText: string;
  timeBorder: string;
  /** Alt imza bandı. */
  footerBg: string;
  footerText: string;
  /** Lig logosu koyu zeminde kaybolmasın diye beyaz rozet üstünde durur. */
  leagueBadge: string | null;
}

const LIGHT_BASE = {
  mode: "light",
  background: "linear-gradient(180deg, #f7f5f0 0%, #ece8df 100%)",
  glow: null,
  text: "#0d1321",
  muted: "#5d6472",
  row: "#ffffff",
  rowBorder: "rgba(13,19,33,0.08)",
  scoreBg: "#0d1321",
  scoreText: "#ffffff",
  timeBg: "#ffffff",
  footerBg: "#0d1321",
  footerText: "rgba(255,255,255,0.72)",
  leagueBadge: null,
} as const;

function light(accent: string): WeeklyTheme {
  return { ...LIGHT_BASE, accent, timeText: accent, timeBorder: accent };
}

function night(from: string, to: string, neon: string): WeeklyTheme {
  return {
    mode: "night",
    background: `linear-gradient(165deg, ${from} 0%, ${to} 100%)`,
    glow: neon,
    text: "#ffffff",
    muted: "rgba(226,232,255,0.66)",
    accent: neon,
    row: "rgba(255,255,255,0.06)",
    rowBorder: "rgba(255,255,255,0.1)",
    scoreBg: neon,
    scoreText: "#070b24",
    timeBg: "rgba(0,0,0,0.25)",
    timeText: neon,
    timeBorder: neon,
    footerBg: "rgba(0,0,0,0.35)",
    footerText: "rgba(226,232,255,0.7)",
    leagueBadge: "#ffffff",
  };
}

const THEMES: Record<SupportedLeagueId, WeeklyTheme> = {
  ucl: night("#0b1446", "#1d0b4a", "#3ee8ff"),
  uel: night("#14100c", "#2a1300", "#ff8a1f"),
  uecl: night("#06201a", "#0b0f1f", "#2bff8a"),
  "super-lig": light("#d90a1b"),
  "tff-1-lig": light("#b5102a"),
  "premier-league": light("#3d195b"),
  "la-liga": light("#e3262f"),
  "serie-a": light("#0a4fd6"),
  bundesliga: light("#d10214"),
  "ligue-1": light("#0b2a63"),
};

export function weeklyTheme(leagueId: SupportedLeagueId): WeeklyTheme {
  return THEMES[leagueId];
}
