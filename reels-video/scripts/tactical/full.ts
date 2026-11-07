import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { freemem } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { Frozen } from "../reel/freeze";
import type { TacticalScript } from "../../src/tactical/types";
import { baseScript } from "./build";
import { finish } from "./finish";
import { planSource, tacticalCaption, tacticalPlan, type PlanItem } from "./plan";
import { buildTimeline, estimated, FPS } from "./timeline";
import { creditPlan, PROFILE, voice } from "./voicing";

/**
 * "Canlı taktik tahtası" tam video (7 beat). Üç kip:
 *   --plan (varsayılan)  senaryo + onaylı metin karşılaştırması + tahmini süre/kredi; ağa çıkmaz, render yok.
 *   --stills [duel,close] tahmini zamanlamayla tek kareler (renderStill); ses yok, kredi yok.
 *   --full --kredi-siniri N  ses (önbellek dışı beat'ler ElevenLabs'e) + tam render + rapor + aciklama + kapak + Telegram önizlemesi.
 *     ağır iş: boş RAM ≥ 4 GB, maç penceresi dışında. Render yalnız ses metni onaylı senaryoyla (`senaryo-tactical.txt`, SES satırları)
 *     birebir aynıysa başlar.
 *   npx tsx --tsconfig tsconfig.json reels-video/scripts/reel-render.ts <maç klasörü> --format tactical --full --kredi-siniri 1500
 */

const arg = (name: string) => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] ?? null : null; };
const stop = (message: string): never => { console.error(`DUR: ${message}`); process.exit(1); };
const mode = process.argv.includes("--full") ? "full" : process.argv.includes("--stills") ? "stills" : "plan";

const folder = path.resolve(process.argv[2] ?? stop("maç klasörü yok"));
const PKG = path.resolve(import.meta.dirname, "../..");
const PUBLIC = path.join(PKG, "public");
const slug = path.basename(folder);
const frozen = JSON.parse(readFileSync(path.join(folder, "snapshot.json"), "utf8")) as Frozen;
if (frozen.detail.score_scene_allowed) console.log("not: servis skor sahnesine izin veriyor; bu formatta skor zaten yok");
const work = path.join(folder, "_taktik");
const out = path.join(folder, "taktik");
mkdirSync(work, { recursive: true });
const voiceCache = path.resolve(PKG, "../../test-photos/reels-voice/_onbellek");

// 1. Zemin (stil testindekiyle aynı: ev sahibi stadyumu bulanık; yoksa koyu çim).
const venue = arg("--venue") ?? path.join(folder, "fotograflar", "Rams Park", "1e3a7a1a16773d78f5a1d7abc722b9f8.jpg");
let backdrop: string | null = null;
if (existsSync(venue)) {
  backdrop = `_local/reel/${slug}/taktik-zemin.jpg`;
  const target = path.join(PUBLIC, backdrop);
  mkdirSync(path.dirname(target), { recursive: true });
  if (!existsSync(target)) await sharp(readFileSync(venue)).rotate().resize(1080, 1920, { fit: "cover", position: sharp.strategy.attention }).blur(9).modulate({ brightness: 0.75, saturation: 0.9 }).jpeg({ quality: 90 }).toFile(target);
}
const { script: base, problems: squadNotes } = baseScript(frozen, backdrop);

// 2. Senaryo (saf kurucu) + onaylı metin.
const source = planSource(frozen);
const { items, problems } = tacticalPlan(source);
if (problems.length) stop(`senaryo engeli: ${problems.join(" | ")}`);
const approvedFile = path.join(folder, "senaryo-tactical.txt");
const approved = existsSync(approvedFile) ? readFileSync(approvedFile, "utf8").split(/\r?\n/u).filter((line) => line.startsWith("SES: ")).map((line) => line.slice(5).trim()) : [];
const drift = items.map((item, index) => (approved[index] === item.sentence ? null : `${item.kind}: onaylı "${approved[index] ?? "—"}" ≠ kurulan "${item.sentence}"`)).filter((line): line is string => line !== null);

// 3. Düello kesimleri: onaylı fotoğrafların önceki üretimdeki kesimleri (yeni Fal çağrısı yok) ya da --duel-home/--duel-away.
function duelPhoto(side: "home" | "away"): string {
  const given = arg(`--duel-${side}`);
  if (given) {
    const target = `_local/reel/${slug}/duel-${side}${path.extname(given)}`;
    copyFileSync(given, path.join(PUBLIC, target));
    return target;
  }
  const previous = path.join(folder, "_uretim", "script.json");
  if (!existsSync(previous)) return "";
  const photos = (JSON.parse(readFileSync(previous, "utf8")) as { photos?: Record<string, { src: string }> }).photos ?? {};
  const src = photos[`${side}-1`]?.src ?? "";
  return src && existsSync(path.join(PUBLIC, src)) ? src : "";
}
const withPhotos: PlanItem[] = items.map((item) => (item.kind === "duel" ? { ...item, values: { ...item.values, homePhoto: duelPhoto("home"), awayPhoto: duelPhoto("away") } } : item));

const scriptOf = (timeline: ReturnType<typeof buildTimeline>): TacticalScript => ({ ...base, beats: timeline.beats, words: timeline.words, durationInFrames: timeline.durationInFrames });
const credit = creditPlan(withPhotos, voiceCache);

if (mode === "plan" || mode === "stills") {
  const timeline = buildTimeline(withPhotos.map((item) => estimated(item, PROFILE.wordsPerSecond)));
  const summary = {
    sozcuk: items.reduce((sum, item) => sum + item.sentence.split(/\s+/u).length, 0),
    tahminiSure: Number((timeline.durationInFrames / FPS).toFixed(1)),
    beatler: timeline.beats.map((beat) => ({ beat: beat.kind, sn: Number((beat.duration / FPS).toFixed(2)) })),
    onayliMetinFarki: drift,
    yeniSes: credit.fresh, tahminiKredi: credit.estimatedCredits,
    duelloKesimleri: withPhotos.find((item) => item.kind === "duel")?.values,
    kadroNotlari: squadNotes,
  };
  writeFileSync(path.join(work, "plan.json"), JSON.stringify({ summary, items: withPhotos }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  if (mode === "plan") process.exit(0);
  // Tek kareler: hafif iş (render yok), yine de boş RAM ≥ 2 GB.
  if (freemem() / 1024 ** 3 < 2) stop("boş RAM < 2 GB");
  const script = scriptOf(timeline);
  const serveUrl = await bundle({ entryPoint: path.join(PKG, "src", "index.ts"), publicDir: PUBLIC });
  const composition = await selectComposition({ serveUrl, id: "TacticalReel", inputProps: { script } });
  const wanted = (arg("--stills") ?? "duel,close").split(",").filter((value) => value && !value.startsWith("--"));
  const stills = path.join(work, "stills");
  mkdirSync(stills, { recursive: true });
  for (const kind of wanted.length ? wanted : ["duel", "close"]) {
    const beat = script.beats.find((item) => item.kind === kind) ?? stop(`beat yok: ${kind}`);
    const local = kind === "close" ? Number(beat.values.moreAt ?? 0) + 12 : Math.min(beat.duration - 3, 48);
    const output = path.join(stills, `${kind}.png`);
    await renderStill({ serveUrl, composition, inputProps: { script }, frame: beat.from + local, output, imageFormat: "png" });
    console.log(`still: ${output} (kare ${beat.from + local})`);
  }
  process.exit(0);
}

// 4. Tam video: önce kapılar.
if (drift.length) stop(`ses metni onaylı senaryodan farklı: ${drift.join(" | ")}`);
const limit = Number(arg("--kredi-siniri") ?? stop("--kredi-siniri yok (önce --plan ile tahmini krediyi gör)"));
const freeGb = freemem() / 1024 ** 3;
if (freeGb < 4) stop(`boş RAM ${freeGb.toFixed(1)} GB < 4`);
console.log(`ses: ${credit.fresh.length} yeni beat (${credit.fresh.join(", ") || "—"}), tahmini ${credit.estimatedCredits} kredi, sınır ${limit}`);
const voiced = await voice(withPhotos, voiceCache, process.env.ELEVENLABS_API_KEY ?? null, limit);
console.log(`ElevenLabs harcaması: ${voiced.credits} kredi`);
const timeline = buildTimeline(voiced.beats);
const script = scriptOf(timeline);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(work, "script.json"), JSON.stringify(script, null, 1));

const serveUrl = await bundle({ entryPoint: path.join(PKG, "src", "index.ts"), publicDir: PUBLIC });
const composition = await selectComposition({ serveUrl, id: "TacticalReel", inputProps: { script } });
const CBR = ["-minrate", "11M", "-x264-params", "nal-hrd=cbr", "-profile:v", "high"];
const silent = path.join(work, "goruntu.mp4");
await renderMedia({ serveUrl, composition, inputProps: { script }, codec: "h264", videoBitrate: "11M", encodingMaxRate: "11M", encodingBufferSize: "22M", x264Preset: "slow",
  ffmpegOverride: ({ args }) => (args.includes("libx264") ? [...args.slice(0, -1), ...CBR, ...args.slice(-1)] : args), pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "png", muted: true, concurrency: 1, outputLocation: silent });
const hook = script.beats[0] ?? stop("beat yok");
await renderStill({ serveUrl, composition, inputProps: { script }, frame: hook.from + Math.round(hook.duration * 0.8), output: path.join(out, "kapak.png"), imageFormat: "png" });
writeFileSync(path.join(out, "aciklama.txt"), `${tacticalCaption(source, items)}\n`);

const report = finish({ folder, work, out, silent, script, timeline, clips: voiced.clips });
writeFileSync(path.join(out, "rapor.json"), JSON.stringify({ ...report, elevenlabs: { credits: voiced.credits, freshBeats: credit.fresh }, kadroNotlari: squadNotes, not: "Format testi: yayınlanmaz." }, null, 1));
console.log(JSON.stringify(report, null, 1));
