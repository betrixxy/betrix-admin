/**
 * Kartların Satori fontları — TEK KAYNAK (bağımlılıksız: build kontrolü `scripts/check-fonts.ts` de
 * buradan okur). Dosyalar `public/fonts/` altındadır; hepsi OFL, Türkçe karakterleri kapsar; Satori
 * woff2 okumadığı için ağırlık başına sabit TTF. Listede olup imajda olmayan dosya, kartı çizim anında
 * ENOENT ile düşürür — build bu yüzden dosyaları doğrular.
 */

/**
 * Maç Günü / set kartları: Geist (gövde metni), Anton (yayın başlıkları), DM Serif Display (editoryal serif).
 */
export const MATCH_DAY_FONT_FILES = [
  { name: "Geist", file: "Geist-Regular.ttf", weight: 400, style: "normal" },
  { name: "Geist", file: "Geist-Bold.ttf", weight: 700, style: "normal" },
  { name: "Geist", file: "Geist-Black.ttf", weight: 900, style: "normal" },
  { name: "Anton", file: "Anton-Regular.ttf", weight: 400, style: "normal" },
  { name: "DM Serif Display", file: "DMSerifDisplay-Regular.ttf", weight: 400, style: "normal" },
  { name: "DM Serif Display", file: "DMSerifDisplay-Italic.ttf", weight: 400, style: "italic" },
] as const;

/**
 * Stüdyo kartları (Muhtemel 11, Haftanın Maçları, Puan Durumu) — CheckMatch marka
 * sisteminin rol bazlı tipografisi (kaynak: CheckMatch içerik motoru `tokens.css`): Space Mono (küçük
 * üst etiket), Bricolage Grotesque (takım adı), Manrope (gövde/oyuncu adı), Archivo Black (büyük rakam).
 */
export const STUDIO_FONT_FILES = [
  { name: "Manrope", file: "Manrope-Medium.ttf", weight: 500 },
  { name: "Manrope", file: "Manrope-SemiBold.ttf", weight: 600 },
  { name: "Manrope", file: "Manrope-ExtraBold.ttf", weight: 800 },
  // Regular: küçük punto etiketler (bkz. `satori-mono.ts::legibleMonoStyle` — Bold'un N'si küçükte dolu blok).
  { name: "Space Mono", file: "SpaceMono-Regular.ttf", weight: 400 },
  { name: "Space Mono", file: "SpaceMono-Bold.ttf", weight: 700 },
  { name: "Bricolage Grotesque", file: "BricolageGrotesque-ExtraBold.ttf", weight: 800 },
  { name: "Archivo Black", file: "ArchivoBlack-Regular.ttf", weight: 400 },
] as const;

/** Kartların okuduğu bütün font dosyaları (tekrarsız). */
export const CARD_FONT_FILES: readonly string[] = [...new Set([...MATCH_DAY_FONT_FILES, ...STUDIO_FONT_FILES].map((font) => font.file))];
