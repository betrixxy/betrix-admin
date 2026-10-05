import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Derinlemesine Analiz kartının fontları — CheckMatch marka sisteminin rol bazlı tipografisi
 * (kaynak: CheckMatch içerik motoru `tokens.css`): Space Mono (küçük üst etiket), Bricolage
 * Grotesque (takım adı), Manrope (gövde/oyuncu adı), Archivo Black (büyük rakam). Hepsi OFL,
 * Türkçe karakterleri kapsar; Satori woff2 okumadığı için ağırlık başına sabit TTF.
 */
const FONT_FILES = [
  { name: "Manrope", file: "Manrope-Medium.ttf", weight: 500 },
  { name: "Manrope", file: "Manrope-SemiBold.ttf", weight: 600 },
  { name: "Manrope", file: "Manrope-ExtraBold.ttf", weight: 800 },
  { name: "Space Mono", file: "SpaceMono-Bold.ttf", weight: 700 },
  { name: "Bricolage Grotesque", file: "BricolageGrotesque-ExtraBold.ttf", weight: 800 },
  { name: "Archivo Black", file: "ArchivoBlack-Regular.ttf", weight: 400 },
] as const;

export interface DeepAnalysisFont {
  name: string;
  data: ArrayBuffer;
  weight: (typeof FONT_FILES)[number]["weight"];
  style: "normal";
}

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
let fontsPromise: Promise<DeepAnalysisFont[]> | null = null;

/** Fontlar süreç başına bir kez okunur. */
export function loadDeepAnalysisFonts(): Promise<DeepAnalysisFont[]> {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ name, file, weight }) => {
      const bytes = await readFile(path.join(FONTS_DIR, file));
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return { name, data, weight, style: "normal" as const };
    }),
  ).catch((error: unknown) => {
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
}
