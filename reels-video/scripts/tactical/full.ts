import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { freemem } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { Frozen } from "../reel/freeze";
import { LAYOUT_PREFIX } from "../../src/tactical/audit";
import type { TacticalScript } from "../../src/tactical/types";
import { baseScript } from "./build";
import { finish } from "./finish";
import { planSource, tacticalCaption, tacticalPlan, type PlanItem } from "./plan";
import { prepare, type Prepared } from "./prepare";
import { buildTimeline, estimated, FPS, MAX_SECONDS } from "./timeline";
import { creditPlan, PROFILE, voice } from "./voicing";

/**
 * "Canlı taktik tahtası" tam video (7 beat). Üç kip:
 *   --plan (varsayılan)  senaryo + onaylı metin karşılaştırması + tahmini süre/kredi; ağa çıkmaz, render yok.
 *   --stills [duel,close,cover] tahmini zamanlamayla tek kareler (renderStill, yerleşim denetimli) ve kapak; ses yok, kredi yok.
 *   --full --kredi-siniri N  ses (önbellek dışı beat'ler ElevenLabs'e) + tam render (kare başına yerleşim denetimi; ihlalde durur)
 *     + rapor + aciklama + kapak + Telegram önizlemesi. Ağır iş: boş RAM ≥ 4 GB, maç penceresi dışında. Render yalnız ses metni onaylı
 *     senaryoyla (`senaryo-tactical.txt`, SES satırları) birebir aynıysa başlar.
 *   npx tsx --tsconfig tsconfig.json reels-video/scripts/reel-render.ts <maç klasörü> --format tactical --full --kredi-siniri 700
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
// Giriş için daha net zemin (düzeltme 2): hafif bulanıklık, aynı kırpma.
let backdropSharp: string | null = null;
if (existsSync(venue)) {
  backdropSharp = `_local/reel/${slug}/taktik-zemin-net.jpg`;
  const target = path.join(PUBLIC, backdropSharp);
  if (!existsSync(target)) await sharp(readFileSync(venue)).rotate().resize(1080, 1920, { fit: "cover", position: sharp.strategy.attention }).blur(1.2).modulate({ brightness: 0.85 }).jpeg({ quality: 92 }).toFile(target);
}
const { script: baseRaw, problems: squadNotes } = baseScript(frozen, backdrop);
const base = { ...baseRaw, backdropSharp };

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

function preparedReport(prepared: Prepared) {
  return {
    kadraj: prepared.framing.map((item) => ({ beat: item.kind, panelAltindaNoktaOnce: item.underBefore, sonra: item.under, kamera: item.camera })),
    kontrast: { panelSaydamligi: prepared.contrast.alpha, enDusukAnaYazi: prepared.contrast.minInk, enDusukYesilYazi: prepared.contrast.minGreen, gecti: prepared.contrast.pass,
      kutular: prepared.contrast.frames.map((item) => ({ beat: item.kind, kare: item.frame, kutular: item.boxes.map((box) => `${box.name} ${box.ink}/${box.green}`) })) },
    kisilanNokta: prepared.dimmedAfter,
  };
}

async function renderCover(serveUrl: string, script: TacticalScript, output: string) {
  const composition = await selectComposition({ serveUrl, id: "TacticalCover", inputProps: { script } });
  await renderStill({ serveUrl, composition, inputProps: { script }, frame: 0, output, imageFormat: "png" });
}

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
  // Tek kareler: hafif iş (render yok), yine de boş RAM ≥ 2 GB. Her karede yerleşim denetimi; "cover" kapağı çizer.
  if (freemem() / 1024 ** 3 < 2) stop("boş RAM < 2 GB");
  const serveUrl = await bundle({ entryPoint: path.join(PKG, "src", "index.ts"), publicDir: PUBLIC });
  const prepared = await prepare(serveUrl, scriptOf(timeline), path.join(work, "hazirlik"));
  writeFileSync(path.join(work, "hazirlik.json"), JSON.stringify(preparedReport(prepared), null, 1));
  console.log(JSON.stringify(preparedReport(prepared), null, 1));
  const script = prepared.script;
  const wanted = (arg("--stills") ?? "duel,close").split(",").filter((value) => value && !value.startsWith("--"));
  const stills = path.join(work, "stills");
  mkdirSync(stills, { recursive: true });
  for (const kind of wanted.length ? wanted : ["duel", "close"]) {
    const output = path.join(stills, `${kind}.png`);
    if (kind === "cover") {
      await renderCover(serveUrl, script, output);
      console.log(`kapak: ${output}`);
      continue;
    }
    const composition = await selectComposition({ serveUrl, id: "TacticalReel", inputProps: { script, audit: true } });
    const beat = script.beats.find((item) => item.kind === kind) ?? stop(`beat yok: ${kind}`);
    const local = kind === "close" ? Number(beat.values.moreAt ?? 0) + 12 : Math.min(beat.duration - 3, 48);
    await renderStill({ serveUrl, composition, inputProps: { script, audit: true }, frame: beat.from + local, output, imageFormat: "png",
      onBrowserLog: ({ text }) => { if (text.includes(LAYOUT_PREFIX)) console.log(text.slice(text.indexOf(LAYOUT_PREFIX))); } });
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
console.log(`ElevenLabs harcaması: ${voiced.credits} kredi; önbellek biçimleri: ${[...new Set(voiced.formats)].join(", ")}`);
for (const note of voiced.notes) console.log(`not: ${note}`);
const timeline = buildTimeline(voiced.beats);
if (timeline.durationInFrames / FPS > MAX_SECONDS) stop(`süre ${(timeline.durationInFrames / FPS).toFixed(2)} sn > ${MAX_SECONDS}`);
mkdirSync(out, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(PKG, "src", "index.ts"), publicDir: PUBLIC });
const prepared = await prepare(serveUrl, scriptOf(timeline), path.join(work, "hazirlik"));
const script = prepared.script;
writeFileSync(path.join(work, "script.json"), JSON.stringify(script, null, 1));
const composition = await selectComposition({ serveUrl, id: "TacticalReel", inputProps: { script, audit: true } });
const CBR = ["-minrate", "11M", "-x264-params", "nal-hrd=cbr", "-profile:v", "high"];
const silent = path.join(work, "goruntu.mp4");
// Kare başına yerleşim denetimi: ihlalde kompozisyon `cancelRender` ile render'ı durdurur (renderMedia hata fırlatır).
const audited = new Set<number>();
const violations: string[] = [];
const onBrowserLog = ({ text }: { text: string }) => {
  if (!text.includes(LAYOUT_PREFIX)) return;
  const parsed = JSON.parse(text.slice(text.indexOf(LAYOUT_PREFIX) + LAYOUT_PREFIX.length)) as { frame: number; issues: string[] };
  audited.add(parsed.frame);
  violations.push(...parsed.issues.map((issue) => `kare ${parsed.frame}: ${issue}`));
};
try {
  await renderMedia({ serveUrl, composition, inputProps: { script, audit: true }, codec: "h264", videoBitrate: "11M", encodingMaxRate: "11M", encodingBufferSize: "22M", x264Preset: "slow",
    ffmpegOverride: ({ args }) => (args.includes("libx264") ? [...args.slice(0, -1), ...CBR, ...args.slice(-1)] : args), pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "png", muted: true, concurrency: 1, outputLocation: silent, onBrowserLog });
} catch (error) {
  writeFileSync(path.join(work, "yerlesim-ihlali.json"), JSON.stringify({ violations, error: String(error) }, null, 1));
  stop(`render durdu: ${violations.slice(0, 6).join(" | ") || String(error)}`);
}
if (audited.size < script.durationInFrames) stop(`yerleşim denetimi eksik: ${audited.size}/${script.durationInFrames} kare`);
// Kapak ve açıklama yalnız içerikleri değiştiyse yeniden üretilir (kullanıcı: değişmiyorsa üretme).
const captionText = `${tacticalCaption(source, items)}\n`;
const captionFile = path.join(out, "aciklama.txt");
const captionChanged = !existsSync(captionFile) || readFileSync(captionFile, "utf8") !== captionText;
if (captionChanged) writeFileSync(captionFile, captionText);
const coverFile = path.join(out, "kapak.png");
const coverKey = JSON.stringify({ home: script.home.name, away: script.away.name, logos: [script.home.logo, script.away.logo], competition: script.competitionLabel, date: script.dateLabel, venue: script.venue, site: script.site, backdrop: script.backdrop });
const coverKeyFile = path.join(work, "kapak-anahtari.json");
// İlk kez anahtar yazılırken mevcut kapak, son onaylı sürümle (aynı kapak kodu) üretildiği için değişmemiş sayılır.
if (existsSync(coverFile) && !existsSync(coverKeyFile)) writeFileSync(coverKeyFile, coverKey);
const coverChanged = !existsSync(coverFile) || readFileSync(coverKeyFile, "utf8") !== coverKey;
if (coverChanged) { await renderCover(serveUrl, script, coverFile); writeFileSync(coverKeyFile, coverKey); }

const report = await finish({ work, out, silent, script, timeline, clips: voiced.clips, layout: { frames: audited.size, violations } });
const legacy = voiced.formats.filter((format) => format === "mp3_44100_128").length;
const voiceNote = legacy ? `${legacy}/${voiced.formats.length} beat önbellekteki 128 kbps mp3 (mono, 44,1 kHz) ile; yeniden üretilmedi` : "hepsi güncel biçim (mp3 192 kbps)";
const hook = script.beats[0];
const full = { ...report, kancaSuresi: hook ? Number((hook.duration / FPS).toFixed(2)) : null, kancaSesi: voiced.beats[0] ? Number(voiced.beats[0].seconds.toFixed(2)) : null,
  hazirlik: preparedReport(prepared), kapakYenilendi: coverChanged, aciklamaYenilendi: captionChanged,
  elevenlabs: { credits: voiced.credits, freshBeats: credit.fresh, onbellekBicimi: voiced.formats, not: voiceNote, bicimNotlari: voiced.notes }, kadroNotlari: squadNotes, not: "Format testi: yayınlanmaz." };
writeFileSync(path.join(out, "rapor.json"), JSON.stringify(full, null, 1));
console.log(JSON.stringify(full, null, 1));
