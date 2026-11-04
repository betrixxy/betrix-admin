import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { copyFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";
import { AUDIT_PREFIX } from "../src/lib/dom-audit";
import { auditProblems, MIN_CONTRAST, parseRgb, relativeLuminance, worstContrast, type LayoutAudit, type TextSample } from "../src/lib/layout-check";
import { buildTimeline } from "../src/lib/motion";
import { flowScript } from "../src/samples";
import type { ReelScript } from "../src/schema";
import { readabilityProblems } from "../src/story/readability";

/**
 * Aktif temada tam akış: her sahneden tek kare + kontak sayfası + denetim. Metin kuralı ihlali render'ı hiç başlatmaz, karede ölçülen
 * ihlal çıkış kodunu 1 yapar. `--mc`: Monte Carlo sahnesinin kısa MP4'ü. Çıktı repoya yazılmaz.
 *
 * Ağır iş: maç penceresinde çalıştırılmaz (CLAUDE.md 5.5). Eşzamanlılık 1; boş RAM ≥ 4 GB koşulunu çalıştıran kontrol eder, komut bakmaz.
 */

const OUT = path.resolve(process.cwd(), "../../test-photos/reels-video/tema-d-e");
const cutouts = process.argv.find((arg) => arg.startsWith("--cutouts="))?.split("=").slice(1).join("=");
const withMc = process.argv.includes("--mc");
const SETTLE = 14;

const LOCAL_PHOTOS = {
  home: { file: "cutout-v1-e0efd626f019c9d1dbe6810588714e9976c151357c80507668ed67991d5c700b.png", aspect: 0.8, face: { x: 0.41, y: 0.2, width: 0.22, height: 0.24 } },
  away: { file: "cutout-v1-61010b2f556792c6d80731e52ca7326ee474d8a6492181e9cb5a41df9f88882d.png", aspect: 1, face: { x: 0.29, y: 0.03, width: 0.27, height: 0.35 } },
} as const;

function withPhotos(script: ReelScript): ReelScript {
  if (!cutouts) return script;
  mkdirSync("public/_local", { recursive: true });
  const photo = (side: "home" | "away") => {
    const item = LOCAL_PHOTOS[side];
    const target = path.join("public/_local", item.file);
    if (!existsSync(target)) copyFileSync(path.join(cutouts, item.file), target);
    return { src: `_local/${item.file}`, aspect: item.aspect, side, focus: { x: 0.5, y: 0.25 }, faces: [item.face], crops: { vertical: { x: 0, y: 0, width: 1, height: 1 }, square: { x: 0, y: 0, width: 1, height: 1 } } };
  };
  return { ...script, photos: { "home-1": photo("home"), "away-1": photo("away") } };
}

const script = withPhotos(flowScript());
const textProblems = readabilityProblems(script);
if (textProblems.length) {
  console.error(`Okunurluk kuralı ihlali, render başlamadı:\n  ${textProblems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
// Önceki koşudan kalan kareler: sahne sırası değişince eski numaralı dosya yanıltır.
for (const name of readdirSync(OUT)) if (/^\d\d-.*\.png$/u.test(name)) rmSync(path.join(OUT, name), { force: true });
const startedAt = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome");
const id = "akis";
const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
const report: Record<string, unknown> = {};
const problems: string[] = [];
const files: string[] = [];

async function contrastOf(masked: string, samples: readonly TextSample[]): Promise<{ found: string[]; lowest: number }> {
  const { data, info } = await sharp(masked).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lowest = Number.POSITIVE_INFINITY;
  const found: string[] = [];
  for (const sample of samples) {
    const rgb = parseRgb(sample.color);
    if (!rgb) continue;
    const luminances: number[] = [];
    for (let y = Math.max(0, Math.floor(sample.y)); y < Math.min(info.height, Math.ceil(sample.y + sample.height)); y += 3) {
      for (let x = Math.max(0, Math.floor(sample.x)); x < Math.min(info.width, Math.ceil(sample.x + sample.width)); x += 3) {
        const at = (y * info.width + x) * 3;
        luminances.push(relativeLuminance(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0));
      }
    }
    const ratio = worstContrast(relativeLuminance(...rgb), luminances);
    lowest = Math.min(lowest, ratio);
    if (ratio < MIN_CONTRAST) found.push(`kontrast ${ratio.toFixed(2)}: ${sample.name}`);
  }
  return { found: [...new Set(found)], lowest };
}

for (const [index, scene] of script.scenes.entries()) {
  const entry = entries[index];
  if (!entry) continue;
  const frame = entry.from + scene.durationInFrames - SETTLE;
  const file = path.join(OUT, `${String(index + 1).padStart(2, "0")}-${scene.type}.png`);
  const props = { script, audit: true, strictSafe: true, videoRules: true };
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
  if (!audit) throw new Error(`Denetim sonucu gelmedi: kare ${frame}`);
  const measured = audit as LayoutAudit;
  const masked = path.join(OUT, `.mask-${index}.png`);
  const maskProps = { ...props, maskText: true };
  const maskComposition = await selectComposition({ serveUrl, id, inputProps: maskProps, puppeteerInstance: browser });
  await renderStill({ composition: maskComposition, serveUrl, frame, output: masked, imageFormat: "png", inputProps: maskProps, puppeteerInstance: browser });
  const contrast = await contrastOf(masked, measured.samples);
  rmSync(masked, { force: true });
  const found = [...auditProblems(measured), ...contrast.found];
  report[scene.type] = { problems: found, fill: measured.fill, lowestContrast: Number(contrast.lowest.toFixed(2)), seconds: scene.durationInFrames / 30, voiceover: scene.voiceover?.text };
  problems.push(...found.map((item) => `${scene.type}: ${item}`));
  console.log(`${scene.type}: doluluk ${measured.fill?.total} / alt ${measured.fill?.lower}, kontrast ${contrast.lowest.toFixed(2)}, ${found.length} sorun`);
  files.push(file);
}

// Döngü: son kare ilk kareyle aynı olmalı, video başa akıcı döner.
const loopFrames = [0, entries.at(-1) ? (entries.at(-1)?.from ?? 0) + (entries.at(-1)?.duration ?? 1) - 1 : 0];
const loopFiles = loopFrames.map((_, index) => path.join(OUT, `.loop-${index}.png`));
for (const [index, frame] of loopFrames.entries()) {
  const loopProps = { script, audit: false, strictSafe: true, videoRules: true };
  const composition = await selectComposition({ serveUrl, id, inputProps: loopProps, puppeteerInstance: browser });
  await renderStill({ composition, serveUrl, frame: frame ?? 0, output: loopFiles[index] ?? "", imageFormat: "png", inputProps: loopProps, puppeteerInstance: browser });
}
const [firstRaw, lastRaw] = await Promise.all(loopFiles.map((file) => sharp(file).removeAlpha().raw().toBuffer()));
let loopSum = 0;
for (let at = 0; firstRaw && lastRaw && at < firstRaw.length; at += 1) loopSum += Math.abs((firstRaw[at] ?? 0) - (lastRaw[at] ?? 0));
const loopDiff = firstRaw ? loopSum / firstRaw.length : 255;
for (const file of loopFiles) rmSync(file, { force: true });
report.loop = { meanDiff: Number(loopDiff.toFixed(2)) };
console.log(`döngü farkı (ilk/son kare, ortalama): ${loopDiff.toFixed(2)}/255`);
if (loopDiff > 3) problems.push(`döngü: son kare ilk kareden farklı (${loopDiff.toFixed(2)})`);

const thumb = { width: 360, height: 640 };
const gap = 12;
const columns = 6;
const composites = await Promise.all(files.map(async (file, index) => ({ input: await sharp(file).resize(thumb).toBuffer(), left: gap + (index % columns) * (thumb.width + gap), top: gap + Math.floor(index / columns) * (thumb.height + gap) })));
writeFileSync(path.join(OUT, "denetim.json"), JSON.stringify(report, null, 1));
for (const problem of problems) console.log(`  ${problem}`);
// Dosya görüntüleyicide açıksa üzerine yazılamaz: yanına yazılır, render boşa gitmez.
const sheet = async (name: string) => sharp({ create: { width: columns * (thumb.width + gap) + gap, height: Math.ceil(files.length / columns) * (thumb.height + gap) + gap, channels: 3, background: "#17191C" } }).composite(composites).png().toFile(path.join(OUT, name));
await sheet("kontak.png").catch(async () => { await sheet("kontak-yeni.png"); console.log("kontak.png kilitli (açık olabilir): kontak-yeni.png yazıldı"); });

if (withMc && problems.length === 0) {
  const composition = await selectComposition({ serveUrl, id: "monte-carlo", inputProps: {}, puppeteerInstance: browser });
  const output = path.join(OUT, "monte-carlo.mp4");
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, pixelFormat: "yuv420p", outputLocation: output, concurrency: 1, puppeteerInstance: browser });
  console.log(`MP4: ${composition.durationInFrames} kare, ${(statSync(output).size / 1024 / 1024).toFixed(1)} MB → ${output}`);
}

await browser.close({ silent: true });
console.log(`toplam ${((Date.now() - startedAt) / 1000).toFixed(0)} sn, ${problems.length} sorun`);
process.exit(problems.length ? 1 : 0);
