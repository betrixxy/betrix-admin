/**
 * Stüdyo kartları (Muhtemel 11, Haftanın Maçları, Puan Durumu) — CheckMatch `tokens.css` font rolleri ve
 * ortak yardımcılar. Fontlar `lib/dashboard/studio-fonts.ts` ile yüklenir.
 */

// ---- font rolleri ----
export const EYEBROW = "Space Mono";
export const TEAM = "Bricolage Grotesque";
export const BODY = "Manrope";
export const SCORE = "Archivo Black";

export const upper = (value: string) => value.toLocaleUpperCase("tr-TR");

/** `hexToRgba` — geçersiz renkte marka yeşili (kaynak şablonla aynı davranış). */
export function rgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  if (!/^[0-9a-f]{6}$/i.test(full) || Number.isNaN(n)) return `rgba(34,194,78,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
