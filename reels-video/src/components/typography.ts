import type { CSSProperties } from "react";
import { TYPE } from "../lib/motion";

/**
 * Hepsi SIL OFL, lisans dosyaları `public/fonts`. Barlow Condensed, JetBrains Mono, Geist: eski sahneler. Tasarım yönleri
 * (`design/tokens.ts`): A Anton + Saira Extra Condensed, B DM Serif Display + Geist, C Unbounded + JetBrains Mono, D Archivo Black + Barlow Condensed, E Caveat Brush + Kalam.
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
  { family: "Anton", file: "Anton-Regular.ttf", weight: "400", sample: 400 },
  { family: "Saira Extra Condensed", file: "SairaExtraCondensed-Bold.ttf", weight: "700", sample: 700 },
  { family: "Saira Extra Condensed", file: "SairaExtraCondensed-Black.ttf", weight: "900", sample: 900 },
  { family: "DM Serif Display", file: "DMSerifDisplay-Regular.ttf", weight: "400", sample: 400 },
  { family: "DM Serif Display", file: "DMSerifDisplay-Italic.ttf", weight: "400", style: "italic", sample: 400 },
  { family: "Unbounded", file: "Unbounded-Variable.ttf", weight: "200 900", sample: 800 },
  { family: "Archivo Black", file: "ArchivoBlack-Regular.ttf", weight: "400", sample: 400 },
  { family: "Caveat Brush", file: "CaveatBrush-Regular.ttf", weight: "400", sample: 400 },
  { family: "Kalam", file: "Kalam-Bold.ttf", weight: "700", sample: 700 },
] as const;

export const LICENSE_FILES = ["OFL-BarlowCondensed.txt", "OFL-JetBrainsMono.txt", "OFL-Geist.txt", "OFL-Anton.txt", "OFL-SairaExtraCondensed.txt", "OFL-DMSerifDisplay.txt", "OFL-Unbounded.txt", "OFL-ArchivoBlack.txt", "OFL-CaveatBrush.txt", "OFL-Kalam.txt"] as const;

/**
 * Rakam tabular denetiminin aileleri. `cellEm`: fontta tabular rakam yoksa her rakam bu genişlikte hücreye girer
 * (`design/kit.tsx::Figures`); denetim en geniş rakamın hücreye sığdığını ölçer.
 */
export const NUMBER_FACES = [
  { family: "Barlow Condensed", weight: 900, cellEm: null },
  { family: "JetBrains Mono", weight: 800, cellEm: null },
  { family: "Anton", weight: 400, cellEm: 0.5 },
  { family: "DM Serif Display", weight: 400, cellEm: 0.545 },
  { family: "Archivo Black", weight: 400, cellEm: 0.68 },
  { family: "Caveat Brush", weight: 400, cellEm: 0.5 },
] as const;

/** Glif denetiminin dizesi. */
export const GLYPH_TEST = "İĞÜŞÖÇ ığüşöç KİM KAZANIR? %74 2–1";

/** Yüzde, sayaç, skor kahramanı: sabit rakam genişliği, sayaç dönerken genişlik oynamaz. */
export const heroNumber = (size: number = TYPE.hero): CSSProperties => ({ fontFamily: FONTS.display, fontWeight: 900, fontSize: size, lineHeight: 0.95, fontVariantNumeric: "tabular-nums" });

export const teamName = (size: number = TYPE.team): CSSProperties => ({ fontFamily: FONTS.display, fontWeight: 600, fontSize: size, lineHeight: 1.05, whiteSpace: "nowrap" });

/** Yalnız rakam içeren öğeler: skor kutucuğu, istatistik değeri, tarih. Harf içeren metinde kullanılmaz (render denetimi). */
export const monoValue = (size: number = TYPE.value): CSSProperties => ({ fontFamily: FONTS.mono, fontWeight: 700, fontSize: size, lineHeight: 1.15, letterSpacing: -1 });

/** Kelime etiketleri ve birimler ("ort.", "gün", "maç", "simülasyon"). */
export const wordLabel = (size: number = TYPE.label): CSSProperties => ({ fontFamily: FONTS.body, fontWeight: 500, fontSize: size, lineHeight: 1.15 });

export const sentence = (size: number = 38, weight: number = 700): CSSProperties => ({ fontFamily: FONTS.body, fontWeight: weight, fontSize: size, lineHeight: 1.2 });
