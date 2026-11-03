import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";
import { FONT_FILES, GLYPH_TEST, LICENSE_FILES } from "../src/components/typography";
import { THEMES } from "../src/design/tokens";
import { AUDIT_PREFIX } from "../src/lib/dom-audit";
import { missingGlyphs } from "../src/lib/font-check";
import { auditProblems, MIN_CONTRAST, parseRgb, relativeLuminance, worstContrast, type LayoutAudit, type TextSample } from "../src/lib/layout-check";
import { buildTimeline } from "../src/lib/motion";
import { boardScript } from "../src/samples";
import { DESIGN_DIRECTIONS, type DesignDirection, type ReelScene, type ReelScript } from "../src/schema";
import { TYPOGRAPHY_PREFIX } from "../src/TypographyTest";

/**
 * Tasarım yönü panosu: her yönde aynı 5 sahne, kurgusal veriyle. Tek kareler + 3 sütunlu karşılaştırma + denetim.
 * Çıktı repoya yazılmaz. Gerçek oyuncu kesimleri (telifli) yalnız `--cutouts=<klasör>` verilince `public/_local`'e kopyalanır;
 * o klasör git'e girmez. Verilmezse kurgusal siluet kullanılır.
 *
 * Maç penceresinde çalıştırılmaz (CLAUDE.md 5.5). Eşzamanlılık 1: tek tarayıcı, sırayla kare.
 */

const OUT = path.resolve(process.cwd(), "../../test-photos/reels-video/style-board");
const SETTLE: Partial<Record<ReelScene["type"], number>> = { S01_COVER: 30, M01_METHOD: 112 };
const argument = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const only = argument("only");
const cutouts = argument("cutouts");
const directions = DESIGN_DIRECTIONS.filter((item) => !only || only.includes(item));

mkdirSync(OUT, { recursive: true });

/** Gerçek kesimler: yüz kutuları elle ölçüldü, yalnız bu iki dosya için. */
const LOCAL_PHOTOS = {
  home: { file: "cutout-v1-e0efd626f019c9d1dbe6810588714e9976c151357c80507668ed67991d5c700b.png", aspect: 0.8, face: { x: 0.41, y: 0.2, width: 0.22, height: 0.24 } },
  away: { file: "cutout-v1-61010b2f556792c6d80731e52ca7326ee474d8a6492181e9cb5a41df9f88882d.png", aspect: 1, face: { x: 0.29, y: 0.03, width: 0.27, height: 0.35 } },
} as const;

function withLocalPhotos(script: ReelScript): ReelScript {
  if (!cutouts) return script;
  const photo = (side: "home" | "away") => {
    const item = LOCAL_PHOTOS[side];
    return { src: `_local/${item.file}`, aspect: item.aspect, side, focus: { x: 0.5, y: 0.25 }, faces: [item.face], crops: { vertical: { x: 0, y: 0, width: 1, height: 1 }, square: { x: 0, y: 0, width: 1, height: 1 } } };
  };
  return { ...script, photos: { "home-1": photo("home"), "away-1": photo("away") } };
}

if (cutouts) {
  mkdirSync("public/_local", { recursive: true });
  for (const item of Object.values(LOCAL_PHOTOS)) {
    const target = path.join("public/_local", item.file);
    if (!existsSync(target)) copyFileSync(path.join(cutouts, item.file), target);
  }
}

const problems: string[] = [];
for (const font of FONT_FILES) {
  const buffer = readFileSync(path.resolve("public/fonts", font.file));
  const missing = missingGlyphs(buffer, `${GLYPH_TEST} ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ abcçdefgğhıijklmnoöprsştuüvyz 0123456789 ·+/`);
  if (missing.length) problems.push(`tofu ${font.file}: ${missing.join(" ")}`);
}
for (const license of LICENSE_FILES) if (!existsSync(path.resolve("public/fonts", license))) problems.push(`lisans yok: ${license}`);

const startedAt = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
console.log(`paket ${((Date.now() - startedAt) / 1000).toFixed(1)} sn`);
const browser = await openBrowser("chrome");

const typeScript = boardScript("A");
const typeComposition = await selectComposition({ serveUrl, id: "tipografi", inputProps: { script: typeScript }, puppeteerInstance: browser });
let typography: { loaded: { family: string; loaded: boolean; weight: number }[]; tabular: { family: string; cellEm: number | null; widths: number[] }[]; uppercase: string[] } | null = null;
await renderStill({
  composition: typeComposition, serveUrl, frame: 0, output: path.join(OUT, "tipografi-testi.png"), inputProps: { script: typeScript }, puppeteerInstance: browser,
  onBrowserLog: ({ text }) => { if (text.includes(TYPOGRAPHY_PREFIX)) typography = JSON.parse(text.slice(text.indexOf(TYPOGRAPHY_PREFIX) + TYPOGRAPHY_PREFIX.length)); },
});
if (!typography) problems.push("tipografi ölçümü gelmedi");
else {
  const measured = typography as { loaded: { family: string; loaded: boolean; weight: number }[]; tabular: { family: string; cellEm: number | null; widths: number[] }[]; uppercase: string[] };
  for (const item of measured.loaded) if (!item.loaded) problems.push(`font yüklenmedi: ${item.family} ${item.weight}`);
  for (const face of measured.tabular) {
    // Ölçüm 200 px'te. Tabular değilse sabit hücreye sığmalı.
    const fixed = face.cellEm === null ? new Set(face.widths).size === 1 : Math.max(...face.widths) <= face.cellEm * 200;
    console.log(`tabular ${face.family}: ${fixed ? (face.cellEm === null ? "evet" : `sabit hücre ${face.cellEm} em`) : `HAYIR ${face.widths.join(",")}`}`);
    if (!fixed) problems.push(`rakam tabular değil: ${face.family}`);
  }
  for (const text of measured.uppercase) if (text !== "KİM KAZANIR, IŞIĞI, İĞDE") problems.push(`Türkçe büyük harf yanlış: ${text}`);
}

/** Metni gizlenmiş kareden metin kutularının arkasını okur, en kötü durum kontrastını döndürür. */
async function contrastProblems(masked: string, samples: readonly TextSample[]): Promise<{ problems: string[]; lowest: number }> {
  const { data, info } = await sharp(masked).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lowest = Number.POSITIVE_INFINITY;
  const found: string[] = [];
  for (const sample of samples) {
    const rgb = parseRgb(sample.color);
    if (!rgb) continue;
    const textLuminance = relativeLuminance(...rgb);
    const luminances: number[] = [];
    const left = Math.max(0, Math.floor(sample.x));
    const right = Math.min(info.width, Math.ceil(sample.x + sample.width));
    const top = Math.max(0, Math.floor(sample.y));
    const bottom = Math.min(info.height, Math.ceil(sample.y + sample.height));
    for (let y = top; y < bottom; y += 3) {
      for (let x = left; x < right; x += 3) {
        const at = (y * info.width + x) * 3;
        luminances.push(relativeLuminance(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0));
      }
    }
    const ratio = worstContrast(textLuminance, luminances);
    lowest = Math.min(lowest, ratio);
    if (ratio < MIN_CONTRAST) found.push(`kontrast ${ratio.toFixed(2)}: ${sample.name}`);
  }
  return { problems: [...new Set(found)], lowest };
}

const report: Record<string, unknown> = {};
const sheets: Record<DesignDirection, string[]> = { A: [], B: [], C: [] };

for (const direction of directions) {
  const script = withLocalPhotos(boardScript(direction));
  const id = `pano-${direction}`;
  const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
  const folder = path.join(OUT, `yon-${direction}-${THEMES[direction].name.toLocaleLowerCase("tr-TR").replaceAll(" ", "-").replaceAll("ı", "i")}`);
  mkdirSync(folder, { recursive: true });
  for (const [index, scene] of script.scenes.entries()) {
    const entry = entries[index];
    if (!entry) continue;
    const offset = SETTLE[scene.type] ?? scene.durationInFrames - 14;
    const frame = entry.from + offset;
    const file = path.join(folder, `${String(index + 1).padStart(2, "0")}-${scene.type}.png`);
    const props = { script, audit: true, strictSafe: true };
    const composition = await selectComposition({ serveUrl, id, inputProps: props, puppeteerInstance: browser });
    let audit: LayoutAudit | null = null;
    await renderStill({
      composition, serveUrl, frame, output: file, imageFormat: "png", inputProps: props, puppeteerInstance: browser,
      onBrowserLog: ({ text }) => {
        if (!text.includes(AUDIT_PREFIX)) return;
        const parsed = JSON.parse(text.slice(text.indexOf(AUDIT_PREFIX) + AUDIT_PREFIX.length)) as { frame: number; audit: LayoutAudit };
        if (parsed.frame === frame) audit = parsed.audit;
      },
    });
    if (!audit) throw new Error(`Denetim sonucu gelmedi: ${id} kare ${frame}`);
    const measured = audit as LayoutAudit;
    const maskedFile = path.join(folder, `.mask-${index}.png`);
    // Denetim açık kalır: kare fontları bekler. Font geç gelirse vurgu kutuları dar çizilir, ölçüm kutunun dışını okur.
    const maskedProps = { ...props, maskText: true };
    const maskedComposition = await selectComposition({ serveUrl, id, inputProps: maskedProps, puppeteerInstance: browser });
    await renderStill({ composition: maskedComposition, serveUrl, frame, output: maskedFile, imageFormat: "png", inputProps: maskedProps, puppeteerInstance: browser });
    const contrast = await contrastProblems(maskedFile, measured.samples);
    const label = `${direction}/${scene.type}`;
    const found = [...auditProblems(measured), ...contrast.problems];
    report[label] = { problems: found, lowestContrast: Number(contrast.lowest.toFixed(2)), faces: measured.faces, texts: measured.samples.length };
    problems.push(...found.map((item) => `${label}: ${item}`));
    console.log(`${label}: en düşük kontrast ${contrast.lowest.toFixed(2)}, ${found.length} sorun`);
    sheets[direction].push(file);
    rmSync(maskedFile, { force: true });
  }
}

await browser.close({ silent: true });

// 3 sütunlu karşılaştırma: sütun = yön, satır = sahne.
if (directions.length === 3) {
  const thumb = { width: 432, height: 768 };
  const gap = 16;
  const head = 90;
  const rows = sheets.A.length;
  const width = 3 * (thumb.width + gap) + gap;
  const height = head + rows * (thumb.height + gap) + gap;
  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (const [column, direction] of directions.entries()) {
    const title = `Yön ${direction} · ${THEMES[direction].name}`;
    composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${thumb.width}" height="${head}"><text x="4" y="62" font-family="Arial" font-weight="700" font-size="32" fill="#FFFFFF">${title}</text></svg>`), left: gap + column * (thumb.width + gap), top: 0 });
    for (const [row, file] of sheets[direction].entries()) composites.push({ input: await sharp(file).resize(thumb).toBuffer(), left: gap + column * (thumb.width + gap), top: head + row * (thumb.height + gap) });
  }
  await sharp({ create: { width, height, channels: 3, background: "#17191C" } }).composite(composites).png().toFile(path.join(OUT, "karsilastirma.png"));
}

writeFileSync(path.join(OUT, "denetim.json"), JSON.stringify(report, null, 1));
console.log(`toplam ${((Date.now() - startedAt) / 1000).toFixed(0)} sn, ${problems.length} sorun`);
for (const problem of problems) console.log(`  ${problem}`);
process.exit(problems.length ? 1 : 0);
