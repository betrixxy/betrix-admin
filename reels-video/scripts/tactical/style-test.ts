import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { freemem } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { Frozen } from "../reel/freeze";
import { buildTrack, cachedVoice, decode, decodeSpans, FFMPEG, RATE, secondsOf, type Span } from "../reel/audio-track";
import { extractFrame, probe } from "../reel/checks";
import type { Alignment, TtsRequest } from "../reel/tts";
import { VOICE_PROFILES } from "../reel/voice";
import type { Beat, SpokenWord, TacticalScript } from "../../src/tactical/types";
import { CAMERAS, baseScript, bannedHits, pct, wordsOf } from "./build";
import { ambience, rms, scaleTo, SFX_SOURCE, whoosh } from "./sfx";
import { tighten } from "./tighten";

/**
 * "Canlı taktik tahtası" ADIM 1 (`--stil-testi`, onaylı 11-07): hook + kazanma ihtimali, önbellekteki seslendirmeyle (kredi yok).
 * Tam video `full.ts`.
 *   npx tsx --tsconfig tsconfig.json reels-video/scripts/reel-render.ts <maç klasörü> --format tactical --stil-testi [--venue <foto>]
 */

const FPS = 30;
const GAP = 0.08;
/**
 * Görüntü bit hızı: CRF 17 bu sade grafikte 2,0 Mbps verdi (stil testi 1, 11-07); hedef ~10–12 Mbps için sabit 11 Mbps (CBR,
 * `nal-hrd=cbr`; 11-06'da 10,6 Mbps ölçüldü). Sabit 11 Mbps'de nicemleme CRF 17'den ince kalır.
 */
const CBR = ["-minrate", "11M", "-x264-params", "nal-hrd=cbr", "-profile:v", "high"];
const arg = (name: string) => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] ?? null : null; };
const stop = (message: string): never => { console.error(`DUR: ${message}`); process.exit(1); };

const folder = process.argv[2] ?? stop("maç klasörü yok");
const PKG = path.resolve(import.meta.dirname, "../..");
const PUBLIC = path.join(PKG, "public");
const slug = path.basename(folder);
const frozen = JSON.parse(readFileSync(path.join(folder, "snapshot.json"), "utf8")) as Frozen;
const work = path.join(folder, "_taktik");
mkdirSync(work, { recursive: true });

// 1. Zemin: ev sahibi stadyumu (arşiv), bulanık; yoksa koyu çim ve eksik kaydı.
const venue = arg("--venue") ?? path.join(folder, "fotograflar", "Rams Park", "1e3a7a1a16773d78f5a1d7abc722b9f8.jpg");
let backdrop: string | null = null;
if (existsSync(venue)) {
  backdrop = `_local/reel/${slug}/taktik-zemin.jpg`;
  const target = path.join(PUBLIC, backdrop);
  mkdirSync(path.dirname(target), { recursive: true });
  await sharp(readFileSync(venue)).rotate().resize(1080, 1920, { fit: "cover", position: sharp.strategy.attention }).blur(9).modulate({ brightness: 0.75, saturation: 0.9 }).jpeg({ quality: 90 }).toFile(target);
} else {
  appendFileSync(path.join(folder, "fotograf-listesi.txt"), `\nEksik stadyum fotoğrafı (taktik zemin): ${frozen.extras.venue ?? "bilinmiyor"} — koyu çim dokusu kullanıldı.\n`);
}
const { script: base, problems } = baseScript(frozen, backdrop);
if (problems.length) console.log(`kadro notları: ${problems.join(" | ")}`);

// 2. Ses: önbellekteki Monte Carlo cümlesi (stil testi). Cümleler zaman damgasından ayrılır; aradaki etiket duraklaması atılır.
const profile = VOICE_PROFILES["buyuk-mac"];
const TEXT = "Maçı yüz bin kez oynattık. [short pause] Galatasaray yüzde yetmiş beş, Amed SFK yüzde on altı, beraberlik yüzde dokuz.";
const request: TtsRequest = { text: TEXT, voiceId: profile.voiceId, modelId: profile.modelId, settings: profile.settings };
const voiceCache = path.resolve(PKG, "../../test-photos/reels-voice/_onbellek");
const cached = cachedVoice(request, voiceCache);
const alignment: Alignment = cached.alignment ?? stop("zaman damgası yok");
const joined = alignment.characters.join("");
function sentenceSpan(sentence: string): Span {
  const at = joined.indexOf(sentence);
  if (at < 0) stop(`cümle bulunamadı: ${sentence}`);
  return { start: Math.max(0, (alignment.character_start_times_seconds[at] ?? 0) - 0.06), end: (alignment.character_end_times_seconds[at + sentence.length - 1] ?? 0) + 0.15 };
}
const o = frozen.detail.outcome;
const outcome = { home: pct(o.home_win), draw: pct(o.draw), away: pct(o.away_win) };
if (Math.abs(outcome.home + outcome.draw + outcome.away - 100) > 1) stop(`kazanma ihtimalleri toplamı ${outcome.home + outcome.draw + outcome.away}`);
const plan: { kind: Beat["kind"]; tag: string; title: string; sentence: string; values: Beat["values"] }[] = [
  { kind: "hook", tag: "SİMÜLASYON", title: "", sentence: "Maçı yüz bin kez oynattık.", values: { ...outcome, hero: outcome.home, heroLabel: `${base.home.short} kazanma ihtimali`, countLabel: "kez oynattık" } },
  { kind: "outcome", tag: "SİMÜLASYON", title: "Kazanma ihtimali", sentence: "Galatasaray yüzde yetmiş beş, Amed SFK yüzde on altı, beraberlik yüzde dokuz.", values: { ...outcome, because: "İç sahada 5 maç: 4 galibiyet, 1 beraberlik" } },
];
const venueRecord = (frozen.extras as unknown as { context: { teams: { home: { venue: { played: number; win: number; draw: number; lose: number } } } } }).context.teams.home.venue;
if (venueRecord.played !== 5 || venueRecord.win !== 4 || venueRecord.draw !== 1) stop("çünkü cümlesi snapshot iç saha kaydıyla tutmuyor");

const beats: Beat[] = [];
const words: SpokenWord[] = [];
const voiceClips: { samples: Float32Array; at: number }[] = [];
let cursor = 0;
plan.forEach((item, index) => {
  const span = sentenceSpan(item.sentence);
  const tight = tighten(decodeSpans(cached.file, [span]), { maxGap: 0.22, lead: 0.03, tail: 0.12 });
  const samples = tight.samples;
  const seconds = secondsOf(samples);
  const isLast = index === plan.length - 1;
  const frames = Math.ceil((seconds + (isLast ? 0.6 : GAP)) * FPS);
  const from = Math.round(cursor * FPS);
  beats.push({ kind: item.kind, tag: item.tag, title: item.title, from, duration: frames, camera: CAMERAS[item.kind], values: item.values });
  words.push(...wordsOf(alignment, span.start, span.end).map((word) => ({ text: word.text, start: from + Math.round(tight.map(word.start - span.start) * FPS), end: from + Math.round(tight.map(word.end - span.start) * FPS), beat: index })));
  voiceClips.push({ samples, at: from / FPS });
  cursor = (from + frames) / FPS;
});
const durationInFrames = Math.round(cursor * FPS);
const script: TacticalScript = { ...base, beats, words, durationInFrames };
const screenTexts = [...beats.flatMap((beat) => [beat.tag, beat.title, ...Object.values(beat.values).filter((value): value is string => typeof value === "string")]), base.legal, base.kickoffLabel, base.competitionLabel];
const banned = bannedHits([...screenTexts, ...plan.map((item) => item.sentence)]);
if (banned.length) stop(`yasak sözcük: ${banned.join(" | ")}`);
writeFileSync(path.join(work, "stil-testi.json"), JSON.stringify(script, null, 1));

// 3. Görüntü (ağır iş: boş RAM ≥ 4 GB).
const freeGb = freemem() / 1024 ** 3;
if (freeGb < 4) stop(`boş RAM ${freeGb.toFixed(1)} GB < 4`);
const serveUrl = await bundle({ entryPoint: path.join(PKG, "src", "index.ts"), publicDir: PUBLIC });
const inputProps = { script };
const composition = await selectComposition({ serveUrl, id: "TacticalReel", inputProps });
const silent = path.join(work, "stil-testi-goruntu.mp4");
await renderMedia({ serveUrl, composition, inputProps, codec: "h264", videoBitrate: "11M", encodingMaxRate: "11M", encodingBufferSize: "22M", x264Preset: "slow",
  ffmpegOverride: ({ args }) => (args.includes("libx264") ? [...args.slice(0, -1), ...CBR, ...args.slice(-1)] : args), pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "png", muted: true, concurrency: 1, outputLocation: silent });

// 4. Ses izi: ses + saha ambiyansı (sesten ~14 dB aşağı → −14 LUFS'ta ≈ −28) + beat geçişlerinde whoosh.
const voiceRms = rms(voiceClips.reduce((all, clip) => { const out = new Float32Array(all.length + clip.samples.length); out.set(all); out.set(clip.samples, all.length); return out; }, new Float32Array(0)));
const total = durationInFrames / FPS;
const effects = [
  { samples: scaleTo(ambience(total), voiceRms * 10 ** (-14 / 20)), at: 0 },
  ...beats.slice(1).map((beat) => ({ samples: scaleTo(whoosh(), voiceRms * 10 ** (-16 / 20)), at: Math.max(0, beat.from / FPS - 0.12) })),
];
const audio = path.join(work, "stil-testi-ses.m4a");
const loud = buildTrack([...voiceClips, ...effects], total, work, audio);
const voiceOnly = path.join(work, "stil-testi-yalniz-ses.m4a");
buildTrack(voiceClips, total, work, voiceOnly);
const output = path.join(folder, "taktik-stil-testi.mp4");
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", output]);

// 5. Denetim: sessizlik (silencedetect −35 dB, yalnız ses izi; son 0,5 sn hariç), kodlama, kareler.
const detect = spawnSync(FFMPEG, ["-hide_banner", "-i", voiceOnly, "-af", "silencedetect=noise=-35dB:d=0.05", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
const silences: { start: number; end: number }[] = [];
for (const match of detect.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/gu)) silences.push({ start: Number(match[1]), end: Number(match[2]) });
const inner = silences.filter((item) => item.end < total - 0.5 && item.start > 0.05);
const longest = inner.reduce((max, item) => Math.max(max, item.end - item.start), 0);
const mixSamples = decode(audio, null);
const probed = probe(output);
const frames = path.join(work, "kareler");
mkdirSync(frames, { recursive: true });
const picks: [string, number][] = [["01-hook-baslangic", 4], ["02-hook", Math.round((beats[0]?.duration ?? 30) * 0.7)], ["03-gecis", (beats[1]?.from ?? 0) + 7], ["04-kazanma", (beats[1]?.from ?? 0) + 30], ["05-son", durationInFrames - 2]];
for (const [name, frame] of picks) extractFrame(output, frame, path.join(frames, `${name}.png`));
const report = {
  dosya: output,
  sure: Number(total.toFixed(2)),
  beatler: beats.map((beat) => ({ beat: beat.kind, kare: beat.duration, sn: Number((beat.duration / FPS).toFixed(2)) })),
  sozcuk: words.length,
  enUzunSessizlik: Number(longest.toFixed(3)),
  sessizlikler: inner,
  loudness: loud.after, kirpilanOrnek: loud.clippedSamples, ornekSayisi: mixSamples.length / 2 / RATE,
  kodlama: probed,
  yasakSozcuk: banned,
  efektKaynagi: SFX_SOURCE,
  kadroNotlari: problems,
};
writeFileSync(path.join(work, "stil-testi-rapor.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
