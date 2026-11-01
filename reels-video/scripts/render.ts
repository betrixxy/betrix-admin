import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";
import { buildTimeline } from "../src/lib/motion";
import { SAMPLES, type SampleId } from "../src/samples";

/**
 * `--stills`: her sahneden bir kare + kontak sayfası (hafif). `--video`: iki MP4 (ağır iş, maç penceresinde çalıştırılmaz).
 * Çıktı repoya yazılmaz: test-photos/reels-video.
 */

const OUT = path.resolve(process.cwd(), "../../test-photos/reels-video");
const mode = process.argv.includes("--video") ? "video" : "stills";
const concurrency = Number(process.argv.find((arg) => arg.startsWith("--concurrency="))?.split("=")[1] ?? 2);

const ids = Object.keys(SAMPLES) as SampleId[];
mkdirSync(OUT, { recursive: true });

const bundleStart = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
console.log(`paket ${((Date.now() - bundleStart) / 1000).toFixed(1)} sn`);

/** Animasyonun oturduğu kare: sahnenin sonuna yakın, geçişten önce. */
const stillOffset = (duration: number): number => (duration <= 20 ? 0 : Math.max(0, duration - 14));

if (mode === "stills") {
  const sheet: { input: string; left: number; top: number }[] = [];
  const thumb = { width: 270, height: 480 };
  for (const [row, id] of ids.entries()) {
    const script = SAMPLES[id];
    const composition = await selectComposition({ serveUrl, id, inputProps: { script } });
    const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
    mkdirSync(path.join(OUT, id), { recursive: true });
    for (const [column, scene] of script.scenes.entries()) {
      const entry = entries[column];
      if (!entry) continue;
      const output = path.join(OUT, id, `${String(column).padStart(2, "0")}-${scene.type}.png`);
      await renderStill({ composition, serveUrl, output, frame: entry.from + stillOffset(entry.duration), inputProps: { script } });
      const thumbFile = `${output}.thumb.png`;
      await sharp(output).resize(thumb).toFile(thumbFile);
      sheet.push({ input: thumbFile, left: column * (thumb.width + 10) + 10, top: row * (thumb.height + 10) + 10 });
    }
    console.log(`kareler: ${id} (${script.scenes.length})`);
  }
  const columns = Math.max(...ids.map((id) => SAMPLES[id].scenes.length));
  await sharp({ create: { width: columns * (thumb.width + 10) + 10, height: ids.length * (thumb.height + 10) + 10, channels: 3, background: "#222" } })
    .composite(sheet)
    .png()
    .toFile(path.join(OUT, "kontak-sayfasi.png"));
  const { rmSync } = await import("node:fs");
  for (const item of sheet) rmSync(item.input);
  console.log(`kontak: ${path.join(OUT, "kontak-sayfasi.png")}`);
} else {
  for (const id of ids) {
    const script = SAMPLES[id];
    const composition = await selectComposition({ serveUrl, id, inputProps: { script } });
    const output = path.join(OUT, `${id}.mp4`);
    const started = Date.now();
    await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, pixelFormat: "yuv420p", outputLocation: output, inputProps: { script }, concurrency });
    const seconds = (Date.now() - started) / 1000;
    console.log(`${id}: ${composition.durationInFrames} kare (${(composition.durationInFrames / composition.fps).toFixed(1)} sn), render ${seconds.toFixed(0)} sn, ${(statSync(output).size / 1024 / 1024).toFixed(1)} MB → ${output}`);
  }
}
