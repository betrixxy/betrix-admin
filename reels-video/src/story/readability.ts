import { FPS } from "../lib/motion";
import type { ReelScene, ReelScript } from "../schema";
import { screenNoteProblem } from "../../../src/lib/reels/analyst-note";
import { WORDS_PER_SECOND, wordCount } from "./speech";

/**
 * Video okunurluk kuralları: ihlal render'ı durdurur. Burası metne ve süreye bakar; piksel kuralları (yazı boyutu, doluluk,
 * satır sayısı) gerçek karede ölçülür (`lib/dom-audit.ts`).
 */

export const MIN_CARD_FRAMES = 4 * FPS;
export const MAX_CARD_FRAMES = 6 * FPS;
/** Etkileşim kartı: 3–4 sn. */
const ENGAGE_FRAMES = [3 * FPS, 4 * FPS] as const;
/** Seslendirme notu okunurken yalnız bu iki kart uzayabilir, sesin gerektirdiği kadar. */
export const MAX_NOTE_CARD_FRAMES = 8 * FPS;
const NOTE_CARDS: readonly string[] = ["C07_KEY", "C09_SCENARIO"];
const readsNote = (voice: ReelScene["voiceover"]): boolean => voice?.lines.some((line) => line.sources.includes("analyst_note")) ?? false;
const framesToSpeak = (text: string): number => Math.ceil(wordCount(text) / WORDS_PER_SECOND) * FPS;

export function noteCardFrames(base: number, voice: ReelScene["voiceover"]): number {
  return voice && readsNote(voice) ? Math.min(MAX_NOTE_CARD_FRAMES, Math.max(base, framesToSpeak(voice.text))) : base;
}
export const MAX_BULLETS = 3;
export const MAX_BULLET_WORDS = 8;

type Bullet = { text: string };

/** Sahnedeki ekran maddeleri. */
export function screenBullets(scene: ReelScene): Bullet[] {
  const data = scene.data as Record<string, unknown>;
  if (Array.isArray(data.points)) return (data.points as { reason: Bullet }[]).map((point) => point.reason);
  if (Array.isArray(data.items)) return data.items as Bullet[];
  if (Array.isArray(data.reasons)) return data.reasons as Bullet[];
  return [];
}

/** Takım adındaki rakam ("Schalke 04") kural dışı: ad çıkarılarak bakılır. */
const stripNames = (text: string, names: readonly string[]): string => names.reduce((value, name) => value.split(name).join(""), text);

export function sceneReadabilityProblems(scene: ReelScene, names: readonly string[]): string[] {
  const problems: string[] = [];
  const voiceNote = NOTE_CARDS.includes(scene.type) && readsNote(scene.voiceover);
  if (scene.type === "S18_ENGAGE") {
    if (scene.durationInFrames < ENGAGE_FRAMES[0] || scene.durationInFrames > ENGAGE_FRAMES[1]) problems.push("etkileşim kartı 3–4 sn olmalı");
  } else if (scene.durationInFrames < MIN_CARD_FRAMES || scene.durationInFrames > (voiceNote ? MAX_NOTE_CARD_FRAMES : MAX_CARD_FRAMES)) problems.push(`süre ${(scene.durationInFrames / FPS).toFixed(1)} sn: ${voiceNote ? "notlu kart en çok 8 sn" : "4–6 sn olmalı"}`);
  if (voiceNote && scene.durationInFrames > MAX_CARD_FRAMES && scene.durationInFrames > framesToSpeak(scene.voiceover?.text ?? "")) problems.push("notlu kart sesin gerektirdiğinden uzun");
  const bullets = screenBullets(scene);
  if (bullets.length > MAX_BULLETS) problems.push(`${bullets.length} madde: en fazla ${MAX_BULLETS}`);
  for (const bullet of bullets) {
    if (wordCount(bullet.text) > MAX_BULLET_WORDS) problems.push(`madde ${wordCount(bullet.text)} sözcük: ${bullet.text}`);
    if (!/\d/u.test(bullet.text)) problems.push(`maddede rakam yok: ${bullet.text}`);
  }
  const note = (scene.data as { analystNote?: unknown }).analystNote;
  const noteProblem = typeof note === "string" ? screenNoteProblem(note) : null;
  if (noteProblem) problems.push(noteProblem);
  const voice = scene.voiceover;
  if (!voice) {
    problems.push("seslendirme yok");
    return problems;
  }
  // Analist notu kullanıcının metni: rakam içerebilir. Süre sınırına not da girer.
  const spoken = voice.lines.filter((line) => !line.sources.includes("analyst_note")).map((line) => line.text).join(" ");
  if (/\d/u.test(stripNames(spoken, names))) problems.push(`seslendirmede rakam: ${spoken}`);
  const limit = Math.floor((scene.durationInFrames / FPS) * WORDS_PER_SECOND);
  if (wordCount(voice.text) > limit) problems.push(`seslendirme ${wordCount(voice.text)} sözcük: ${scene.durationInFrames / FPS} sn için en fazla ${limit}`);
  const longest = Math.max(0, ...bullets.map((bullet) => wordCount(bullet.text)));
  if (bullets.length && wordCount(voice.text) <= longest) problems.push("seslendirme ekrandaki maddeden uzun değil");
  return problems;
}

export function readabilityProblems(script: Pick<ReelScript, "scenes" | "meta">): string[] {
  const names = [script.meta.teams.home.name, script.meta.teams.home.shortName, script.meta.teams.away.name, script.meta.teams.away.shortName];
  return script.scenes.flatMap((scene) => sceneReadabilityProblems(scene, names).map((problem) => `${scene.type}: ${problem}`));
}
