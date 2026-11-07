import type { Beat, SpokenWord } from "../../src/tactical/types";
import { CAMERAS } from "./build";
import type { PlanItem } from "./plan";

/**
 * Plan + ölçülen (ya da tahmini) ses → beat'ler, kelime zamanları, efekt anları. Saf. Beat süresi sesten: ses + 0,08 sn; kapanış
 * beat'i sesten sonra logo animasyonunu taşır (✓ 0,6 sn çizilir, bekleme 0,9 sn ≤ 1 sn).
 */

export const FPS = 30;
export const GAP = 0.08;
export const CLOSE_TIMING = { tickStart: 12, tickEvery: 20, logoDelay: 6, logoDraw: 18, logoHold: 27 } as const;

export interface TimedWord { text: string; start: number; end: number }
export interface VoicedBeat { item: PlanItem; seconds: number; words: TimedWord[] }

export interface Timeline { beats: Beat[]; words: SpokenWord[]; durationInFrames: number; voiceAt: number[]; ticks: number[] }

/** Altyazı yazımı: okunan "checkmatch nokta net'te" ekranda "www.checkmatch.net'te" (tek sözcük, ilk sözcüğün başı → son sözcüğün sonu). */
export function screenWords(words: readonly TimedWord[]): TimedWord[] {
  const out: TimedWord[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const [a, b, c] = [words[i], words[i + 1], words[i + 2]];
    if (a && b && c && a.text.toLocaleLowerCase("tr-TR") === "checkmatch" && b.text.toLocaleLowerCase("tr-TR") === "nokta" && /^net/iu.test(c.text)) {
      out.push({ text: `www.checkmatch.${c.text}`, start: a.start, end: c.end });
      i += 2;
    } else if (a) out.push(a);
  }
  return out;
}

/** Sesi henüz olmayan beat (still / plan): sözcükler ölçülen konuşma hızıyla eşit aralıklı. */
export function estimated(item: PlanItem, wordsPerSecond: number): VoicedBeat {
  const tokens = item.sentence.split(/\s+/u).filter(Boolean);
  const step = 1 / wordsPerSecond;
  return { item, seconds: tokens.length * step, words: tokens.map((text, index) => ({ text, start: index * step, end: (index + 1) * step - 0.05 })) };
}

export function buildTimeline(voiced: readonly VoicedBeat[]): Timeline {
  const beats: Beat[] = [];
  const words: SpokenWord[] = [];
  const voiceAt: number[] = [];
  const ticks: number[] = [];
  let cursor = 0;
  voiced.forEach(({ item, seconds, words: spoken }, index) => {
    const from = cursor;
    const voiceFrames = Math.ceil(seconds * FPS);
    const values: Beat["values"] = { ...item.values };
    // İkinci cümlenin ilk sözcüğü: iki parçalı beat'te ikinci katman o anda gelir.
    const secondAt = spoken.findIndex((word, at) => at > 0 && /[.?!]$/u.test(spoken[at - 1]?.text ?? ""));
    if (secondAt > 0) values.sentence2At = Math.round((spoken[secondAt]?.start ?? 0) * FPS);
    let duration = Math.ceil((seconds + GAP) * FPS);
    if (item.kind === "close") {
      const every = Math.max(8, Math.min(CLOSE_TIMING.tickEvery, Math.floor((voiceFrames - CLOSE_TIMING.tickStart - 24) / 5)));
      const tickFrames = [0, 1, 2, 3].map((k) => CLOSE_TIMING.tickStart + k * every);
      tickFrames.forEach((frame, k) => { values[`t${k + 1}`] = frame; });
      values.lockedAt = CLOSE_TIMING.tickStart + 4 * every;
      values.moreAt = CLOSE_TIMING.tickStart + 5 * every;
      const logoAt = voiceFrames + CLOSE_TIMING.logoDelay;
      values.logoAt = logoAt;
      values.logoDraw = CLOSE_TIMING.logoDraw;
      duration = logoAt + CLOSE_TIMING.logoDraw + CLOSE_TIMING.logoHold;
      ticks.push(...tickFrames.map((frame) => from + frame), from + logoAt + CLOSE_TIMING.logoDraw);
    }
    beats.push({ kind: item.kind, tag: item.tag, title: item.title, from, duration, camera: CAMERAS[item.kind], values });
    words.push(...screenWords(spoken).map((word) => ({ text: word.text, start: from + Math.round(word.start * FPS), end: from + Math.round(word.end * FPS), beat: index })));
    voiceAt.push(from);
    cursor = from + duration;
  });
  return { beats, words, durationInFrames: cursor, voiceAt, ticks };
}
