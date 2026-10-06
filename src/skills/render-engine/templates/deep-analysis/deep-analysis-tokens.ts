/** Derinlemesine Analiz kartı — CheckMatch `tokens.css` renkleri, font rolleri ve ortak yardımcılar. */

// ---- tokens.css ----
export const NAVY_800 = "#0a1a2f";
export const NAVY_700 = "#0f2540";
export const GREEN = "#22c24e";
export const GREEN_BR = "#37e06a";
export const GREEN_DK = "#148a37";
export const YELLOW = "#f5c518";
export const GRAY = "#b7c2cf";

// ---- font rolleri ----
export const EYEBROW = "Space Mono";
export const TEAM = "Bricolage Grotesque";
export const BODY = "Manrope";
export const SCORE = "Archivo Black";

export const MAX_WIDTH = 940;
/** Kapak yüksekliği — lib/dashboard/analysis-hero-compose.ts HERO_SIZE ile aynı. */
export const HERO_HEIGHT = 460;
export const PANEL = { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14 } as const;

export const upper = (value: string) => value.toLocaleUpperCase("tr-TR");
export const filled = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

/** `hexToRgba` — geçersiz renkte marka yeşili (kaynak şablonla aynı davranış). */
export function rgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  if (!/^[0-9a-f]{6}$/i.test(full) || Number.isNaN(n)) return `rgba(34,194,78,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

