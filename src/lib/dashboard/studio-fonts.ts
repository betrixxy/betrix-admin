import { readFile } from "node:fs/promises";
import path from "node:path";
import { STUDIO_FONT_FILES } from "@/lib/dashboard/card-font-files";

/** Stüdyo kartlarının fontları — liste `card-font-files.ts`'te (build kontrolüyle ortak tek kaynak). */
const FONT_FILES = STUDIO_FONT_FILES;

export interface StudioFont {
  name: string;
  data: ArrayBuffer;
  weight: (typeof FONT_FILES)[number]["weight"];
  style: "normal";
}

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
let fontsPromise: Promise<StudioFont[]> | null = null;

/** Fontlar süreç başına bir kez okunur. */
export function loadStudioFonts(): Promise<StudioFont[]> {
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
