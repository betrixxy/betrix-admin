/**
 * Build kontrolü: kartların okuduğu her font dosyası `public/fonts/` altında var ve geçerli bir
 * TrueType/OpenType dosyası mı? Docker `builder` aşamasında `next build`'den önce koşar; eksik
 * ya da bozuk dosyada build durur (yoksa kart çizim anında ENOENT ile düşer — bkz. card-font-files.ts).
 *
 *   npx tsx scripts/check-fonts.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { CARD_FONT_FILES } from "@/lib/dashboard/card-font-files";

/** sfnt imzaları: TrueType (00 01 00 00, "true") ve CFF tabanlı OpenType ("OTTO"). */
const SFNT_SIGNATURES = new Set(["00010000", "74727565", "4f54544f"]);

function problem(file: string): string | null {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path.join(process.cwd(), "public", "fonts", file));
  } catch {
    return "dosya yok";
  }
  if (bytes.byteLength < 1024) return `çok küçük (${bytes.byteLength} bayt)`;
  return SFNT_SIGNATURES.has(bytes.subarray(0, 4).toString("hex")) ? null : "geçerli bir TTF/OTF değil";
}

const failures = CARD_FONT_FILES.flatMap((file) => {
  const reason = problem(file);
  return reason ? [`  - public/fonts/${file}: ${reason}`] : [];
});

if (failures.length > 0) {
  console.error(`Kart fontları eksik ya da bozuk:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Kart fontları tamam (${CARD_FONT_FILES.length} dosya).`);
