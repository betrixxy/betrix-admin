import type { CSSProperties } from "react";
import { TYPE } from "../lib/motion";

/**
 * Role göre üç aile (hepsi SIL OFL, lisans dosyaları `public/fonts`).
 * Barlow Condensed: başlık, büyük rakam, takım adı. JetBrains Mono: skor, tarih, istatistik. Geist: cümleler.
 */
export const FONTS = { display: "Barlow Condensed", mono: "JetBrains Mono", body: "Geist" } as const;

/** Dosya + kesim. Render, tipografi testi ve lisans testi aynı listeden okur. */
export const FONT_FILES = [
  { family: FONTS.display, file: "BarlowCondensed-SemiBold.ttf", weight: "600", sample: 600 },
  { family: FONTS.display, file: "BarlowCondensed-ExtraBold.ttf", weight: "800", sample: 800 },
  { family: FONTS.display, file: "BarlowCondensed-Black.ttf", weight: "900", sample: 900 },
  { family: FONTS.mono, file: "JetBrainsMono-Variable.ttf", weight: "100 800", sample: 700 },
  { family: FONTS.body, file: "Geist-Regular.ttf", weight: "500", sample: 500 },
  { family: FONTS.body, file: "Geist-Bold.ttf", weight: "700", sample: 700 },
  { family: FONTS.body, file: "Geist-Black.ttf", weight: "900", sample: 900 },
] as const;

export const LICENSE_FILES = ["OFL-BarlowCondensed.txt", "OFL-JetBrainsMono.txt", "OFL-Geist.txt"] as const;

/** Glif denetiminin dizesi. */
export const GLYPH_TEST = "İĞÜŞÖÇ ığüşöç KİM KAZANIR? %74 2–1";

/** Yüzde, sayaç, skor kahramanı: sabit rakam genişliği, sayaç dönerken genişlik oynamaz. */
export const heroNumber = (size: number = TYPE.hero): CSSProperties => ({ fontFamily: FONTS.display, fontWeight: 900, fontSize: size, lineHeight: 0.95, fontVariantNumeric: "tabular-nums" });

export const teamName = (size: number = TYPE.team): CSSProperties => ({ fontFamily: FONTS.display, fontWeight: 600, fontSize: size, lineHeight: 1.05, whiteSpace: "nowrap" });

/** Skor kutucuğu, istatistik değeri, tarih. */
export const monoValue = (size: number = TYPE.value): CSSProperties => ({ fontFamily: FONTS.mono, fontWeight: 700, fontSize: size, lineHeight: 1.15, letterSpacing: -1 });

/** xG, ort., gün gibi istatistik etiketleri. */
export const monoLabel = (size: number = TYPE.label): CSSProperties => ({ fontFamily: FONTS.mono, fontWeight: 500, fontSize: size, lineHeight: 1.15, letterSpacing: -1 });

export const sentence = (size: number = 38, weight: number = 700): CSSProperties => ({ fontFamily: FONTS.body, fontWeight: weight, fontSize: size, lineHeight: 1.2 });
