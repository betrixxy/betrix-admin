import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import type { TacticalScript } from "../../src/tactical/types";
import { buildTrack, decode, FFMPEG, TARGET } from "../reel/audio-track";
import { extractFrame, probe } from "../reel/checks";
import { noiseFloor, silences, spectrogram } from "./audio-qc";
import { bannedHits } from "./build";
import { rms, scaleTo, SFX_SOURCE, tick } from "./sfx";
import { FPS, type Timeline } from "./timeline";

/**
 * Tam videonun ses izi, birleştirme ve denetimleri (kullanıcı 2026-11-07 düzeltmesi): YALNIZ temiz seslendirme + kapanıştaki ✓ tık
 * sesi (saf sinüs, gürültü yok; ambiyans ve gürültü tabanlı whoosh kaldırıldı). −14 LUFS, true peak ≤ −1,5 dBTP (loudnorm hedefi
 * −2,0; AAC payı). Sessiz bölümde gürültü tabanı ≤ −60 dB; spektrogram PNG. Cümle içi en uzun sessizlik ≤ 0,35 sn. Telegram
 * önizlemesi ≤ 48 MB.
 */

const TELEGRAM_BYTES = 48 * 1024 * 1024;
export const MAX_SILENCE = 0.35;
export const MAX_TRUE_PEAK = -1.5;
export const MAX_NOISE_FLOOR = -60;
const TRUE_PEAK_TARGET = -2;

export async function finish(input: { work: string; out: string; silent: string; script: TacticalScript; timeline: Timeline; clips: Float32Array[]; layout: { frames: number; violations: string[] } }) {
  const { work, out, silent, script, timeline, clips } = input;
  const total = script.durationInFrames / FPS;
  const voiceClips = clips.map((samples, index) => ({ samples, at: (timeline.voiceAt[index] ?? 0) / FPS }));
  const joined = clips.reduce((all, clip) => { const next = new Float32Array(all.length + clip.length); next.set(all); next.set(clip, all.length); return next; }, new Float32Array(0));
  const ticks = timeline.ticks.map((frame) => ({ samples: scaleTo(tick(), rms(joined) * 10 ** (-10 / 20)), at: frame / FPS }));
  const audio = path.join(work, "ses.m4a");
  const loud = buildTrack([...voiceClips, ...ticks], total, work, audio, TRUE_PEAK_TARGET);
  const voiceOnly = path.join(work, "yalniz-ses.m4a");
  buildTrack(voiceClips, total, work, voiceOnly, TRUE_PEAK_TARGET);
  const output = path.join(out, "taktik-tahtasi.mp4");
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", output]);

  // Cümle içi sessizlik: yalnız ses izinde, beat içi aralıklar (beat arası boşluk ve logo bekleyişi cümle içi değildir).
  const voiceGaps = silences(voiceOnly);
  const inside = voiceGaps.filter((item) => item.start > 0.05 && script.beats.some((beat, index) => {
    const start = (timeline.voiceAt[index] ?? beat.from) / FPS;
    const end = start + (clips[index]?.length ?? 0) / 2 / 48000;
    return item.start >= start && item.end <= end - 0.05;
  }));
  const longest = inside.reduce((max, item) => Math.max(max, item.end - item.start), 0);
  // Gürültü tabanı: son miksin sessiz bölümleri.
  const mix = decode(audio, null);
  const floor = noiseFloor(mix, silences(audio));
  const spectrum = path.join(out, "spektrogram.png");
  await spectrogram(mix, spectrum);

  const frames = path.join(work, "kareler");
  mkdirSync(frames, { recursive: true });
  script.beats.forEach((beat, index) => extractFrame(output, beat.from + Math.min(beat.duration - 3, 45), path.join(frames, `${String(index + 1).padStart(2, "0")}-${beat.kind}.png`)));
  extractFrame(output, script.durationInFrames - 6, path.join(frames, "08-logo-son.png"));

  const preview = path.join(out, "telegram-onizleme.mp4");
  if (statSync(output).size <= TELEGRAM_BYTES) execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", output, "-c", "copy", preview]);
  else {
    const videoBits = Math.floor(((TELEGRAM_BYTES * 0.94 * 8) / total - 192_000) / 1000);
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", output, "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoBits}k`, "-maxrate", `${videoBits}k`, "-bufsize", `${videoBits * 2}k`, "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "copy", "-movflags", "+faststart", preview]);
  }

  const screen = script.beats.flatMap((beat) => [beat.tag, beat.title, ...Object.values(beat.values).filter((value): value is string => typeof value === "string")]);
  const banned = bannedHits([...screen, script.legal, script.site, ...script.words.map((word) => word.text)]);
  const problems = [
    ...(longest > MAX_SILENCE ? [`en uzun iç sessizlik ${longest.toFixed(2)} sn > ${MAX_SILENCE}`] : []),
    ...(loud.after.truePeak > MAX_TRUE_PEAK ? [`true peak ${loud.after.truePeak} dBTP > ${MAX_TRUE_PEAK}`] : []),
    ...(Math.abs(loud.after.lufs - TARGET.lufs) > 0.5 ? [`loudness ${loud.after.lufs} LUFS (hedef ${TARGET.lufs})`] : []),
    ...(floor.db > MAX_NOISE_FLOOR ? [`gürültü tabanı ${floor.db} dB > ${MAX_NOISE_FLOOR}`] : []),
    ...(loud.clippedSamples ? [`kırpılan örnek ${loud.clippedSamples}`] : []),
    ...(statSync(preview).size > TELEGRAM_BYTES ? ["önizleme 48 MB'ı aşıyor"] : []),
    ...input.layout.violations.map((item) => `çakışma: ${item}`),
    ...banned.map((hit) => `yasak sözcük: ${hit}`),
  ];
  return {
    dosya: output, onizleme: preview, onizlemeMB: Number((statSync(preview).size / 1024 / 1024).toFixed(1)), spektrogram: spectrum,
    sure: Number(total.toFixed(2)),
    beatler: script.beats.map((beat, index) => ({ beat: beat.kind, sn: Number((beat.duration / FPS).toFixed(2)), ses: Number(((clips[index]?.length ?? 0) / 2 / 48000).toFixed(2)) })),
    sozcuk: script.words.length,
    enUzunSessizlik: Number(longest.toFixed(3)),
    loudness: loud.after, kirpilanOrnek: loud.clippedSamples,
    gurultuTabani: floor,
    cakismaDenetimi: { denetlenenKare: input.layout.frames, ihlal: input.layout.violations.length },
    yasakSozcuk: banned.length,
    kodlama: probe(output),
    efektKaynagi: SFX_SOURCE,
    sorunlar: problems,
  };
}
