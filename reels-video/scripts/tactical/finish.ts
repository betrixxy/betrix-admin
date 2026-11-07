import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import type { TacticalScript } from "../../src/tactical/types";
import { buildTrack, FFMPEG } from "../reel/audio-track";
import { extractFrame, probe } from "../reel/checks";
import { bannedHits } from "./build";
import { ambience, rms, scaleTo, SFX_SOURCE, tick, whoosh } from "./sfx";
import { FPS, type Timeline } from "./timeline";

/**
 * Tam videonun ses izi, birleştirme ve denetimleri: ses + ambiyans (−14 dB) + geçiş whoosh'u (−16 dB) + tık (kontrol kutuları ve
 * logodaki ✓, −10 dB); −14 LUFS / −1 dBTP; silencedetect −35 dB (yalnız ses izi) en uzun iç sessizlik ≤ 0,35 sn; ffprobe; beat başına
 * bir kare; Telegram önizlemesi ≤ 48 MB (gerekirse yalnız bit hızı düşürülerek yeniden kodlanır, ses kopyalanır).
 */

const TELEGRAM_BYTES = 48 * 1024 * 1024;
export const MAX_SILENCE = 0.35;

export function finish(input: { folder: string; work: string; out: string; silent: string; script: TacticalScript; timeline: Timeline; clips: Float32Array[] }) {
  const { work, out, silent, script, timeline, clips } = input;
  const total = script.durationInFrames / FPS;
  const voiceClips = clips.map((samples, index) => ({ samples, at: (timeline.voiceAt[index] ?? 0) / FPS }));
  const joined = clips.reduce((all, clip) => { const next = new Float32Array(all.length + clip.length); next.set(all); next.set(clip, all.length); return next; }, new Float32Array(0));
  const voiceRms = rms(joined);
  const effects = [
    { samples: scaleTo(ambience(total), voiceRms * 10 ** (-14 / 20)), at: 0 },
    ...script.beats.slice(1).map((beat) => ({ samples: scaleTo(whoosh(), voiceRms * 10 ** (-16 / 20)), at: Math.max(0, beat.from / FPS - 0.12) })),
    ...timeline.ticks.map((frame) => ({ samples: scaleTo(tick(), voiceRms * 10 ** (-10 / 20)), at: frame / FPS })),
  ];
  const audio = path.join(work, "ses.m4a");
  const loud = buildTrack([...voiceClips, ...effects], total, work, audio);
  const voiceOnly = path.join(work, "yalniz-ses.m4a");
  buildTrack(voiceClips, total, work, voiceOnly);
  const output = path.join(out, "taktik-tahtasi.mp4");
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", output]);

  const detect = spawnSync(FFMPEG, ["-hide_banner", "-i", voiceOnly, "-af", "silencedetect=noise=-35dB:d=0.05", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const silences: { start: number; end: number }[] = [];
  for (const match of detect.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/gu)) silences.push({ start: Number(match[1]), end: Number(match[2]) });
  // Beat aralarındaki boşluk (geçiş + kapanış logosu) cümle içi sessizlik değildir: yalnız beat içi aralıklar ölçülür.
  const inside = silences.filter((item) => item.start > 0.05 && script.beats.some((beat, index) => {
    const start = beat.from / FPS;
    const end = start + (clips[index]?.length ?? 0) / 2 / 48000;
    return item.start >= start && item.end <= end - 0.05;
  }));
  const longest = inside.reduce((max, item) => Math.max(max, item.end - item.start), 0);

  const frames = path.join(work, "kareler");
  mkdirSync(frames, { recursive: true });
  script.beats.forEach((beat, index) => extractFrame(output, beat.from + Math.min(beat.duration - 3, 45), path.join(frames, `${String(index + 1).padStart(2, "0")}-${beat.kind}.png`)));

  const preview = path.join(out, "telegram-onizleme.mp4");
  const size = statSync(output).size;
  if (size <= TELEGRAM_BYTES) execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", output, "-c", "copy", preview]);
  else {
    const videoBits = Math.floor(((TELEGRAM_BYTES * 0.94 * 8) / total - 192_000) / 1000);
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", output, "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoBits}k`, "-maxrate", `${videoBits}k`, "-bufsize", `${videoBits * 2}k`, "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "copy", "-movflags", "+faststart", preview]);
  }

  const screen = script.beats.flatMap((beat) => [beat.tag, beat.title, ...Object.values(beat.values).filter((value): value is string => typeof value === "string")]);
  const problems = [
    ...(longest > MAX_SILENCE ? [`en uzun iç sessizlik ${longest.toFixed(2)} sn > ${MAX_SILENCE}`] : []),
    ...(loud.clippedSamples ? [`kırpılan örnek ${loud.clippedSamples}`] : []),
    ...(statSync(preview).size > TELEGRAM_BYTES ? ["önizleme 48 MB'ı aşıyor"] : []),
    ...bannedHits([...screen, ...script.words.map((word) => word.text)]).map((hit) => `yasak sözcük: ${hit}`),
  ];
  return {
    dosya: output, onizleme: preview, onizlemeMB: Number((statSync(preview).size / 1024 / 1024).toFixed(1)),
    sure: Number(total.toFixed(2)),
    beatler: script.beats.map((beat, index) => ({ beat: beat.kind, sn: Number((beat.duration / FPS).toFixed(2)), ses: Number(((clips[index]?.length ?? 0) / 2 / 48000).toFixed(2)) })),
    sozcuk: script.words.length,
    enUzunSessizlik: Number(longest.toFixed(3)),
    loudness: loud.after, kirpilanOrnek: loud.clippedSamples,
    kodlama: probe(output),
    efektKaynagi: SFX_SOURCE,
    sorunlar: problems,
  };
}
