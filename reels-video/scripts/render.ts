import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";
import { AUDIT_PREFIX } from "../src/lib/dom-audit";
import { auditProblems, type LayoutAudit } from "../src/lib/layout-check";
import { FONT_FILES, GLYPH_TEST, LICENSE_FILES } from "../src/components/typography";
import { missingGlyphs } from "../src/lib/font-check";
import { buildTimeline } from "../src/lib/motion";
import { TYPOGRAPHY_PREFIX } from "../src/TypographyTest";
import { SAMPLE_KEYS, sampleScripts } from "../src/samples";
import type { ReelScene, ReelScript } from "../src/schema";

/**
 * `--stills`: havuzun 16 sahnesinden tek kare + 4×4 kontak sayfası + yerleşim denetimi (sorun varsa çıkış 1).
 * `--video`: seçilen hikâyelerin MP4'ü (ağır iş; maç penceresinde çalıştırılmaz). Çıktı repoya yazılmaz.
 */

const OUT = path.resolve(process.cwd(), "../../test-photos/reels-video/v2");
const video = process.argv.includes("--video");
const concurrency = Number(process.argv.find((arg) => arg.startsWith("--concurrency="))?.split("=")[1] ?? 2);
const PHOTO_SCENES = new Set(["S01_COVER", "S03_HOOK", "S07_KEY_GAP", "S16_SUMMARY", "P01_DUEL", "Q01_WINNER"]);
const WIPE = 8;

mkdirSync(OUT, { recursive: true });
const startedAt = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
console.log(`paket ${((Date.now() - startedAt) / 1000).toFixed(1)} sn`);
const browser = await openBrowser("chrome");

/** Fotoğraf çıkan kare: animasyon oturmuş, çıkış geçişi başlamamış. */
const settleFrame = (scene: ReelScene): number => (scene.type === "S16_SUMMARY" ? 195 : scene.durationInFrames - WIPE - 4);
/** Denetim kareleri: yakın (hareket ortası) + oturmuş; özet kartında üç evre. */
const auditFrames = (scene: ReelScene): number[] => (scene.type === "S16_SUMMARY" ? [195, 260, 320] : [Math.max(WIPE + 2, Math.floor(scene.durationInFrames * 0.45)), settleFrame(scene)]);

async function still(id: string, script: ReelScript, frame: number, output: string | null): Promise<LayoutAudit> {
  const composition = await selectComposition({ serveUrl, id, inputProps: { script, audit: true }, puppeteerInstance: browser });
  let audit: LayoutAudit | null = null;
  await renderStill({
    composition, serveUrl, frame, output, imageFormat: output ? "png" : "jpeg", inputProps: { script, audit: true }, puppeteerInstance: browser,
    onBrowserLog: ({ text }) => {
      if (!text.includes(AUDIT_PREFIX)) return;
      const parsed = JSON.parse(text.slice(text.indexOf(AUDIT_PREFIX) + AUDIT_PREFIX.length)) as { frame: number; audit: LayoutAudit };
      if (parsed.frame === frame) audit = parsed.audit;
    },
  });
  if (!audit) throw new Error(`Denetim sonucu gelmedi: ${id} kare ${frame}`);
  return audit;
}

if (video) {
  for (const key of SAMPLE_KEYS) {
    const { story } = sampleScripts(key);
    const id = `reel-${key}`;
    const composition = await selectComposition({ serveUrl, id, inputProps: { script: story }, puppeteerInstance: browser });
    const output = path.join(OUT, `${id}.mp4`);
    const started = Date.now();
    await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, pixelFormat: "yuv420p", outputLocation: output, inputProps: { script: story }, concurrency, puppeteerInstance: browser });
    console.log(`${id}: ${composition.durationInFrames} kare (${(composition.durationInFrames / composition.fps).toFixed(1)} sn), render ${((Date.now() - started) / 1000).toFixed(0)} sn, ${(statSync(output).size / 1024 / 1024).toFixed(1)} MB → ${output}`);
  }
} else {
  const report: Record<string, unknown> = {};
  const problems: string[] = [];

  // Tipografi: dosyada glif, tarayıcıda yüklü font, sabit rakam genişliği, Türkçe büyütme.
  for (const font of FONT_FILES) {
    const buffer = readFileSync(path.resolve("public/fonts", font.file));
    const missing = missingGlyphs(buffer, GLYPH_TEST);
    if (missing.length) problems.push(`tofu ${font.file}: ${missing.join(" ")}`);
    if (missingGlyphs(buffer, "\uE000").length !== 1) problems.push(`glif denetimi kontrolü başarısız: ${font.file}`);
  }
  for (const license of LICENSE_FILES) if (!existsSync(path.resolve("public/fonts", license))) problems.push(`lisans yok: ${license}`);
  const typeScript = sampleScripts(SAMPLE_KEYS[0] ?? "derbi").pool;
  const typeComposition = await selectComposition({ serveUrl, id: "tipografi", inputProps: { script: typeScript }, puppeteerInstance: browser });
  let typography: { loaded: { family: string; weight: number; loaded: boolean }[]; tabular: { family: string; cellEm: number | null; widths: number[] }[]; uppercase: string[] } | null = null;
  await renderStill({
    composition: typeComposition, serveUrl, frame: 0, output: path.join(OUT, "tipografi-testi.png"), inputProps: { script: typeScript }, puppeteerInstance: browser,
    onBrowserLog: ({ text }) => { if (text.includes(TYPOGRAPHY_PREFIX)) typography = JSON.parse(text.slice(text.indexOf(TYPOGRAPHY_PREFIX) + TYPOGRAPHY_PREFIX.length)); },
  });
  if (!typography) problems.push("tipografi ölçümü gelmedi");
  else {
    const measured = typography as { loaded: { family: string; weight: number; loaded: boolean }[]; tabular: { family: string; cellEm: number | null; widths: number[] }[]; uppercase: string[] };
    for (const item of measured.loaded) if (!item.loaded) problems.push(`font yüklenmedi: ${item.family} ${item.weight}`);
    for (const face of measured.tabular) {
      const fixed = face.cellEm === null ? new Set(face.widths).size === 1 : Math.max(...face.widths) <= face.cellEm * 200;
      if (!fixed) problems.push(`rakam tabular değil: ${face.family}`);
    }
    for (const text of measured.uppercase) if (text !== "KİM KAZANIR, IŞIĞI, İĞDE") problems.push(`Türkçe büyük harf yanlış: ${text}`);
  }
  const thumb = { width: 360, height: 640 };
  const gap = 12;
  for (const key of SAMPLE_KEYS) {
    const { pool, story } = sampleScripts(key);
    const id = `havuz-${key}`;
    const { entries } = buildTimeline(pool.scenes.map((scene) => scene.durationInFrames));
    const folder = path.join(OUT, key);
    mkdirSync(folder, { recursive: true });
    const sheet: { input: Buffer; left: number; top: number }[] = [];
    if (pool.disabled.length) console.log(`${key} havuz dışı: ${pool.disabled.map((item) => `${item.type} (${item.reason})`).join(", ")}`);
    for (const [index, scene] of pool.scenes.entries()) {
      const entry = entries[index];
      if (!entry) continue;
      const file = path.join(folder, `${String(index + 1).padStart(2, "0")}-${scene.type}.png`);
      for (const offset of auditFrames(scene)) {
        const audit = await still(id, pool, entry.from + offset, offset === settleFrame(scene) ? file : null);
        report[`${key}/${scene.type}@${offset}`] = audit;
        problems.push(...auditProblems(audit).map((problem) => `${key}/${scene.type}@${offset}: ${problem}`));
        const photoShown = PHOTO_SCENES.has(scene.type) && !(scene.type === "S16_SUMMARY" && offset !== 260);
        if (photoShown && audit.faces === 0) problems.push(`${key}/${scene.type}@${offset}: yüz kutusu ölçülmedi, denetim boş geçti`);
      }
      sheet.push({ input: await sharp(file).resize(thumb).toBuffer(), left: (index % 4) * (thumb.width + gap) + gap, top: Math.floor(index / 4) * (thumb.height + gap) + gap });
    }
    // Akışta görünen ama kontak sayfasına girmeyen evreler ve yedek dal.
    const summaryIndex = pool.scenes.findIndex((scene) => scene.type === "S16_SUMMARY");
    const summaryEntry = entries[summaryIndex];
    if (summaryEntry) {
      await still(id, pool, summaryEntry.from + 260, path.join(folder, "ek-S16-soru.png"));
      await still(id, pool, summaryEntry.from + 320, path.join(folder, "ek-S16-kapanis.png"));
    }
    // Hareketin ara kareleri: silme geçişi ve kendini çizen tik. Video öncesi tek kare kontrol.
    const hookEntry = entries[pool.scenes.findIndex((scene) => scene.type === "S03_HOOK")];
    if (hookEntry) await still(id, pool, hookEntry.from + 4, path.join(folder, "ek-gecis.png"));
    const logoEntry = entries[pool.scenes.findIndex((scene) => scene.type === "S02_LOGO")];
    if (logoEntry) await still(id, pool, logoEntry.from + 12, path.join(folder, "ek-logo-cizim.png"));
    const rows = Math.ceil(pool.scenes.length / 4);
    await sharp({ create: { width: 4 * (thumb.width + gap) + gap, height: rows * (thumb.height + gap) + gap, channels: 3, background: "#2A2A2A" } }).composite(sheet).png().toFile(path.join(OUT, `kontak-${key}.png`));
    const seconds = buildTimeline(story.scenes.map((scene) => scene.durationInFrames)).total / 30;
    console.log(`${key}: havuz ${pool.scenes.length} sahne; hikâye ${story.scenes.length} sahne, ${seconds.toFixed(1)} sn: ${story.scenes.map((scene) => scene.type.slice(0, 3)).join(" ")}`);
  }
  writeFileSync(path.join(OUT, "denetim.json"), JSON.stringify(report, null, 1));
  console.log(`denetim: ${Object.keys(report).length} kare, ${problems.length} sorun, ${((Date.now() - startedAt) / 1000).toFixed(0)} sn`);
  for (const problem of problems) console.log(`  ${problem}`);
  await browser.close({ silent: true });
  process.exit(problems.length ? 1 : 0);
}
await browser.close({ silent: true });
