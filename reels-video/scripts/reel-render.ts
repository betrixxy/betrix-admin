import "./reel/setup-env";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { freemem } from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { AUDIT_PREFIX } from "../src/lib/dom-audit";
import { auditProblems, type LayoutAudit } from "../src/lib/layout-check";
import { buildTimeline, FPS } from "../src/lib/motion";
import { reelScriptSchema, type ReelScript } from "../src/schema";
import { MAX_NOTE_CARD_FRAMES, readabilityProblems, voicedCardFrames } from "../src/story/readability";
import { buildReel, captionFiles, scenarioText } from "./reel/build";
import type { Frozen } from "./reel/freeze";
import { FAL_USD_PER_SECOND, falSpend, prepareBackdrop, prepareCutout } from "./reel/assets";
import { buildTrack, cachedVoice, decodeSpans, FFMPEG, keptSpans, secondsOf, TARGET, type Span } from "./reel/audio-track";
import { compareFrame, extractFrame, probe } from "./reel/checks";
import { contrastOf } from "./reel/contrast";
import { synthesize, type TtsRequest } from "./reel/tts";
import { pronounce, VOICE_PROFILES } from "./reel/voice";

/**
 * Onaylı senaryodan video. Kalite kuralları (kullanıcı 11-06, CLAUDE.md): süre hedef 75–95 sn, 100 sn üstü durur; kısaltma yalnız
 * metinden (onaylı satır listesi), ses hızı sabit; ses kartı − 0,3 sn'yi geçmez; klipler 40 ms yumuşak geçişli; −14 LUFS / −1 dBTP;
 * AAC 48 kHz 192 kbps; H.264 High ~11 Mbps BT.709. `--plan`: kısaltılmış senaryoyu ölçülen ses süreleriyle yazar, ses/görüntü üretmez.
 *   npx tsx --tsconfig tsconfig.json reels-video/scripts/reel-render.ts <maç klasörü> --senaryo <onaylı.txt> [--kisaltma <satırlar.json>] [--plan]
 *     --home --away --venue --home-team --away-team <fotoğraf>
 */

const arg = (name: string) => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] ?? null : null; };
const stop =(message: string): never => { console.error(`DUR: ${message}`); process.exit(1); };
const folder = process.argv[2] ?? stop("maç klasörü yok");
const PKG = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(PKG, "public");
const MAX_SECONDS = 100;
const TARGET_SECONDS = [75, 95] as const;
const WORD_GUARD = 0.3;
const SETTLE = 14;
const DARKNESS = [0.42, 0.3, 0.2] as const;
const BACKDROP_SCENES: Record<string, "venue" | "home" | "away"> = { S01_COVER: "venue", M02_MONTE_CARLO: "venue", C04_TEAM_HOME: "home", C05_TEAM_AWAY: "away" };
const FRAMES_TO_SAVE: [string, string][] = [["S01_COVER", "01-kapak"], ["M02_MONTE_CARLO", "02-monte-carlo"], ["C04_TEAM_HOME", "03-takim-analizi"], ["Q05_BOTH_SCORE", "04-gol-olasiligi"], ["C09_SCENARIO", "05-senaryo"], ["S17_CLOSE", "06-kapanis"]];
const SHARPNESS_MIN = 0.85;
const GREEN_DELTA_MAX = 3;

const frozen = JSON.parse(readFileSync(path.join(folder, "snapshot.json"), "utf8")) as Frozen;
const slug = path.basename(folder);
const profile = VOICE_PROFILES["buyuk-mac"];
const trimFile = arg("--kisaltma");
const drops = trimFile ? (JSON.parse(readFileSync(trimFile, "utf8")) as string[]) : [];
const full = buildReel(frozen, profile);
const reel = buildReel(frozen, profile, drops);
if (reel.problems.length) stop(`senaryo engeli: ${reel.problems.join(" | ")}`);
const voiceCache = path.resolve(PKG, "../../test-photos/reels-voice/_onbellek");
const work = path.join(folder, "_uretim");
mkdirSync(work, { recursive: true });
/** `--reuse-video`: önceki koşunun sessiz görüntüsü, sahne betiği birebir aynıysa yeniden kullanılır (render tekrarlanmaz). */
const previousScript = existsSync(path.join(work, "script.json")) ? readFileSync(path.join(work, "script.json"), "utf8") : null;
const request = (text: string): TtsRequest => ({ text, voiceId: profile.voiceId, modelId: profile.modelId, settings: profile.settings });

// 1. Ses klipleri: önbellekten; satır çıkarılan sahnede tam sesin zaman damgasından kesilir (kredi yok). Önbellekte olmayan sahne
// planda "yeni seslendirme" diye işaretlenir, render'da üretilir.
const planOnly = process.argv.includes("--plan");
let credits = 0;
const fresh: string[] = [];
const clips: (Float32Array | null)[] = [];
for (const [index, text] of reel.spoken.entries()) {
  if (!text) { clips.push(null); continue; }
  let source: { file: string; spans: Span[] | null } | null = null;
  try {
    source = { file: cachedVoice(request(text), voiceCache).file, spans: null };
  } catch {
    const fullText = full.spoken[index];
    const kept = new Set(reel.script.scenes[index]?.voiceover?.lines.map((line) => line.id));
    const dropped = (full.script.scenes[index]?.voiceover?.lines ?? []).filter((line) => !kept.has(line.id)).map((line) => pronounce(line.text));
    if (fullText && dropped.length) {
      const cached = cachedVoice(request(fullText), voiceCache);
      if (!cached.alignment) stop(`${reel.script.scenes[index]?.type}: zaman damgası yok, kesilemez`);
      source = { file: cached.file, spans: keptSpans(cached.alignment ?? stop("zaman damgası yok"), dropped) };
    }
  }
  if (!source) {
    fresh.push(`${reel.script.scenes[index]?.type}`);
    if (planOnly) { clips.push(null); continue; }
    const result = await synthesize(request(text), { apiKey: process.env.ELEVENLABS_API_KEY ?? stop("ELEVENLABS_API_KEY yok"), cacheDir: voiceCache });
    credits += result.credits;
    source = { file: cachedVoice(request(text), voiceCache).file, spans: null };
  }
  clips.push(decodeSpans(source.file, source.spans));
}
const measured = clips.map((clip) => (clip ? Number(secondsOf(clip).toFixed(2)) : null));

// 2. Kart süresi ölçülen sesten; kelime kesilmesi denetimi: ses ≤ kart − 0,3 sn.
const scenes = reel.script.scenes.map((scene, index) => {
  const seconds = measured[index];
  if (!seconds) return scene;
  const cap = scene.type === "S18_ENGAGE" ? 4 * FPS : MAX_NOTE_CARD_FRAMES;
  return { ...scene, durationInFrames: Math.min(cap, voicedCardFrames(scene.durationInFrames, Math.ceil(seconds * FPS))) };
});
const timed = { ...reel, script: { ...reel.script, scenes } };
const total = buildTimeline(scenes.map((scene) => scene.durationInFrames)).total / FPS;
const guard = scenes.flatMap((scene, index) => { const seconds = measured[index]; return seconds && seconds > scene.durationInFrames / FPS - WORD_GUARD ? [`${scene.type}: ses ${seconds} sn > kart ${(scene.durationInFrames / FPS).toFixed(2)} − ${WORD_GUARD}`] : []; });
const header = [`Kısaltma (çıkarılan seslendirme satırları): ${drops.length ? drops.join(", ") : "yok"}`, ...(fresh.length ? [`Yeni seslendirme gerekir: ${fresh.join(", ")}`] : [])];
const text = scenarioText(timed, frozen, header, measured);
if (planOnly) {
  writeFileSync(path.join(folder, "senaryo-buyuk-mac-kisa.txt"), text);
  console.log(text.split("\n").slice(0, 9).join("\n"));
  console.log(`video ${total.toFixed(1)} sn (hedef ${TARGET_SECONDS.join("–")}, en çok ${MAX_SECONDS}) | kelime kesilmesi: ${guard.length ? guard.join(" | ") : "yok"} | yeni seslendirme: ${fresh.join(", ") || "yok"}`);
  process.exit(0);
}
const approved = arg("--senaryo") ?? stop("--senaryo (onaylı metin) verilmedi");
if (readFileSync(approved, "utf8") !== text) stop(`senaryo onaylı ${path.basename(approved)} ile aynı değil`);
if (total > MAX_SECONDS) stop(`video ${total.toFixed(1)} sn > ${MAX_SECONDS}`);
if (guard.length) stop(`kelime kesilmesi: ${guard.join(" | ")}`);

// 3. Görseller.
const cache = path.join(folder, "fotograflar", "_secim");
const need = (name: string) => arg(name) ?? stop(`${name} verilmedi`);
const home = await prepareCutout(need("--home"), "home", cache, PUBLIC, slug);
const away = await prepareCutout(need("--away"), "away", cache, PUBLIC, slug);
const backdropFiles = { venue: need("--venue"), home: need("--home-team"), away: need("--away-team") };
const level: Record<string, number> = Object.fromEntries(Object.keys(BACKDROP_SCENES).map((type) => [type, 0]));
async function backdrops(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [type, source] of Object.entries(BACKDROP_SCENES)) {
    const darkness = DARKNESS[level[type] ?? 0];
    if (darkness !== undefined && scenes.some((scene) => scene.type === type)) out[type] = await prepareBackdrop(backdropFiles[source], source, darkness, PUBLIC, slug);
  }
  return out;
}
const voiceFrames = measured.map((seconds) => (seconds ? { src: "-", frames: Math.ceil(seconds * FPS) } : null));
const scriptWith = async (): Promise<ReelScript> => reelScriptSchema.parse({ ...timed.script, voice: voiceFrames, photos: { "home-1": home.photo, "away-1": away.photo }, backdrops: await backdrops() });
let script = await scriptWith();
const textProblems = readabilityProblems(script);
if (textProblems.length) stop(`okunurluk: ${textProblems.join(" | ")}`);
/** Remotion'a giden senaryo sessizdir: ses izi ayrı kurulup birleştirilir. */
const visual = () => ({ ...script, voice: undefined });

// 4. Kare denetimi (yerleşim, güvenli alan, kontrast, yüz), zemin kontrastı geçmezse koyulaşır, sonra kalkar.
if (freemem() < 4 * 1024 ** 3) stop(`boş RAM ${(freemem() / 1024 ** 3).toFixed(1)} GB < 4 GB`);
const serveUrl = await bundle({ entryPoint: path.join(PKG, "src/index.ts"), publicDir: PUBLIC });
const browser = await openBrowser("chrome");
const id = "gercek";
async function still(props: Record<string, unknown>, frame: number, output: string): Promise<LayoutAudit | null> {
  const composition = await selectComposition({ serveUrl, id, inputProps: props, puppeteerInstance: browser });
  let audit: LayoutAudit | null = null;
  await renderStill({
    composition, serveUrl, frame, output, imageFormat: "png", inputProps: props, puppeteerInstance: browser,
    onBrowserLog: ({ text: line }) => {
      if (!line.includes(AUDIT_PREFIX)) return;
      const parsed = JSON.parse(line.slice(line.indexOf(AUDIT_PREFIX) + AUDIT_PREFIX.length)) as { frame: number; audit: LayoutAudit };
      if (parsed.frame === frame) audit = parsed.audit;
    },
  });
  return audit;
}
const report: Record<string, unknown> = {};
const settle: Record<string, { frame: number; png: string; boxes: LayoutAudit["samples"] }> = {};
async function auditAll(only: Set<string> | null): Promise<{ problems: string[]; contrastFailed: Set<string> }> {
  const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
  const problems: string[] = [];
  const contrastFailed = new Set<string>();
  for (const [index, scene] of script.scenes.entries()) {
    const entry = entries[index];
    if (!entry || (only && !only.has(scene.type))) continue;
    const frame = entry.from + scene.durationInFrames - SETTLE;
    const props = { script: visual(), audit: true, strictSafe: true, videoRules: true };
    const png = path.join(work, `${String(index + 1).padStart(2, "0")}-${scene.type}.png`);
    const audit = await still(props, frame, png);
    if (!audit) { problems.push(`${scene.type}: denetim sonucu gelmedi`); continue; }
    const masked = path.join(work, `.mask-${index}.png`);
    await still({ ...props, maskText: true }, frame, masked);
    const contrast = await contrastOf(masked, audit.samples);
    rmSync(masked, { force: true });
    const showsFace = scene.type === "S01_COVER" || scene.type === "P01_DUEL";
    const found = [...auditProblems(audit), ...(showsFace && audit.faces === 0 ? ["yüz kutusu ölçülmedi"] : [])];
    if (contrast.found.length) { if (scene.type in BACKDROP_SCENES && script.backdrops?.[scene.type]) contrastFailed.add(scene.type); else found.push(...contrast.found); }
    settle[scene.type] = { frame, png, boxes: audit.samples };
    report[scene.type] = { seconds: scene.durationInFrames / FPS, audio: measured[index], fill: audit.fill, faces: audit.faces, lowestContrast: Number(contrast.lowest.toFixed(2)), backdrop: script.backdrops?.[scene.type] ?? null, problems: [...found, ...contrast.found] };
    problems.push(...found.map((item) => `${scene.type}: ${item}`));
    console.log(`${scene.type}: ${(scene.durationInFrames / FPS).toFixed(1)} sn, ses ${measured[index] ?? "-"}, kontrast ${contrast.lowest.toFixed(2)}, yüz ${audit.faces}, ${found.length + contrast.found.length} sorun${script.backdrops?.[scene.type] ? " [zemin]" : ""}`);
  }
  return { problems, contrastFailed };
}
let result = await auditAll(null);
for (let round = 0; round < DARKNESS.length && result.contrastFailed.size; round += 1) {
  for (const type of result.contrastFailed) level[type] = (level[type] ?? 0) + 1;
  script = await scriptWith();
  console.log(`zemin: ${[...result.contrastFailed].map((type) => `${type} → ${DARKNESS[level[type] ?? 0] ?? "düz"}`).join(", ")}`);
  const again = await auditAll(result.contrastFailed);
  result = { problems: [...result.problems, ...again.problems], contrastFailed: again.contrastFailed };
}
const plain = { script: visual(), audit: false, strictSafe: true, videoRules: true };
const frames = buildTimeline(script.scenes.map((scene) => scene.durationInFrames)).total;
const loop = [path.join(work, ".loop-0.png"), path.join(work, ".loop-1.png")] as const;
await still(plain, 0, loop[0]);
await still(plain, frames - 1, loop[1]);
const { loopDifference } = await import("./reel/contrast");
const loopDiff = await loopDifference(loop[0], loop[1]);
if (loopDiff > 3) result.problems.push(`döngü: son kare ilk kareden farklı (${loopDiff.toFixed(2)})`);
writeFileSync(path.join(work, "script.json"), JSON.stringify(script, null, 1));
if (result.problems.length) { await browser.close({ silent: true }); writeFileSync(path.join(work, "denetim.json"), JSON.stringify({ report, problems: result.problems }, null, 1)); stop(`denetim:\n  ${result.problems.join("\n  ")}`); }

// 5. Sessiz görüntü (H.264 High, ~11 Mbps, BT.709) + ses izi (−14 LUFS) → birleştir.
if (freemem() < 4 * 1024 ** 3) stop(`render öncesi boş RAM ${(freemem() / 1024 ** 3).toFixed(1)} GB < 4 GB`);
await still(plain, 0, path.join(folder, "kapak.png"));
const silent = path.join(work, "goruntu.mp4");
const composition = await selectComposition({ serveUrl, id, inputProps: plain, puppeteerInstance: browser });
const started = Date.now();
const reuse = process.argv.includes("--reuse-video") && existsSync(silent) && previousScript === JSON.stringify(script, null, 1);
if (reuse) console.log("görüntü: önceki render kullanıldı (sahne betiği aynı)");
else {
  // Hedef ~11 Mbps: x264 ABR sade grafikte hedefin çok altına iniyor (6,1 ve 4,2 Mbps ölçüldü); -minrate yalnız CBR kipinde
  // (nal-hrd=cbr) uygulanır — bu derlemede 10,6 Mbps doğrulandı. Kareler PNG yakalanır (JPEG 80 yazı kenarını kodlamadan önce bozar).
  const tune = ["-minrate", "11M", "-x264-params", "nal-hrd=cbr", "-profile:v", "high"];
  await renderMedia({
    composition, serveUrl, codec: "h264", videoBitrate: "11M", encodingMaxRate: "11M", encodingBufferSize: "22M", x264Preset: "slow", pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "png", muted: true, outputLocation: silent, inputProps: plain, concurrency: 1, puppeteerInstance: browser,
    ffmpegOverride: ({ type, args }) => {
      if (!args.includes("libx264")) return args;
      const next = [...args.slice(0, -1), ...tune, ...args.slice(-1)];
      console.log(`kodlayıcı (${type}): ${next.filter((item): item is string => typeof item === "string" && (item.startsWith("-") || /^\d+M$|^(high|slow|libx264|yuv420p|bt709|nal-hrd=cbr)$/u.test(item))).join(" ")}`);
      return next;
    },
  });
}
await browser.close({ silent: true });
const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
const placed = clips.flatMap((clip, index) => (clip && entries[index] ? [{ samples: clip, at: (entries[index]?.from ?? 0) / FPS }] : []));
const audioFile = path.join(work, "ses.m4a");
const loudness = buildTrack(placed, frames / FPS, work, audioFile);
const output = path.join(folder, `${slug}.mp4`);
execFileSync(FFMPEG, ["-hide_banner", "-y", "-i", silent, "-i", audioFile, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", output], { stdio: "ignore" });

// 6. Render sonrası denetim: kodlama, loudness, 6 karede netlik ve marka yeşili.
const probed = probe(output);
const post: string[] = [...probed.problems];
if (Math.abs(loudness.after.lufs - TARGET.lufs) > 1) post.push(`loudness ${loudness.after.lufs} LUFS`);
if (loudness.after.truePeak > TARGET.truePeak + 0.1) post.push(`true peak ${loudness.after.truePeak} dBTP`);
if (loudness.clippedSamples > 0) post.push(`kırpılma: ${loudness.clippedSamples} örnek`);
const framesDir = path.join(folder, "kareler");
mkdirSync(framesDir, { recursive: true });
const frameChecks: Record<string, unknown> = {};
for (const [type, name] of FRAMES_TO_SAVE) {
  const item = settle[type];
  if (!item) { post.push(`${name}: sahne yok`); continue; }
  const decoded = path.join(framesDir, `${name}.png`);
  extractFrame(output, item.frame, decoded);
  if (!existsSync(decoded)) { post.push(`${name}: kare çözülemedi`); continue; }
  const check = await compareFrame(item.png, decoded, item.boxes, script.brand.accent);
  frameChecks[name] = check;
  if (check.sharpness !== null && check.sharpness < SHARPNESS_MIN) post.push(`${name}: metin netliği ${check.sharpness} (< ${SHARPNESS_MIN})`);
  if (check.green.deltaE !== null && check.green.deltaE > GREEN_DELTA_MAX) post.push(`${name}: yeşil sapması ΔE ${check.green.deltaE} (> ${GREEN_DELTA_MAX})`);
}
writeFileSync(path.join(folder, "aciklama.txt"), captionFiles(reel, frozen));
const summary = {
  mp4: output, seconds: Number(probed.seconds.toFixed(1)), megabytes: Number(probed.megabytes.toFixed(1)), videoMbps: probed.videoMbps, audioKbps: probed.audioKbps, profile: probed.profile, renderSeconds: Math.round((Date.now() - started) / 1000),
  loudness, elevenlabs: { newCredits: credits, freshScenes: fresh }, fal: { calls: falSpend.calls, usdUpperBound: Number((falSpend.seconds * FAL_USD_PER_SECOND).toFixed(4)) },
  backdrops: script.backdrops, loopDiff: Number(loopDiff.toFixed(2)), frameChecks, postProblems: post,
};
writeFileSync(path.join(work, "denetim.json"), JSON.stringify({ report, summary }, null, 1));
console.log(JSON.stringify(summary, null, 1));
process.exit(post.length ? 2 : 0);
