import { FPS } from "../lib/motion";
import type { ReelScene, ReelScript } from "../schema";
import { NOTE_SCREEN_CHARS } from "./claims";
import { WORDS_PER_SECOND, wordCount } from "./speech";

/**
 * Video okunurluk kuralları: ihlal render'ı durdurur. Burası metne ve süreye bakar; piksel kuralları (yazı boyutu, doluluk,
 * satır sayısı) gerçek karede ölçülür (`lib/dom-audit.ts`).
 */

export const MIN_CARD_FRAMES = 4 * FPS;
export const MAX_CARD_FRAMES = 6 * FPS;
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
  if (scene.durationInFrames < MIN_CARD_FRAMES || scene.durationInFrames > MAX_CARD_FRAMES) problems.push(`süre ${(scene.durationInFrames / FPS).toFixed(1)} sn: 4–6 sn olmalı`);
  const bullets = screenBullets(scene);
  if (bullets.length > MAX_BULLETS) problems.push(`${bullets.length} madde: en fazla ${MAX_BULLETS}`);
  for (const bullet of bullets) {
    if (wordCount(bullet.text) > MAX_BULLET_WORDS) problems.push(`madde ${wordCount(bullet.text)} sözcük: ${bullet.text}`);
    if (!/\d/u.test(bullet.text)) problems.push(`maddede rakam yok: ${bullet.text}`);
  }
  const note = (scene.data as { analystNote?: unknown }).analystNote;
  if (typeof note === "string" && note.length > NOTE_SCREEN_CHARS) problems.push(`analist notu ekranda uzun: ${note.length} karakter`);
  const voice = scene.voiceover;
  if (!voice) {
    problems.push("seslendirme yok");
    return problems;
  }
  // Analist notu kullanıcının metni: rakam içerebilir, hız sınırı ayrı raporlanır (`noteOverrun`).
  const spoken = voice.lines.filter((line) => !line.sources.includes("analyst_note")).map((line) => line.text).join(" ");
  if (/\d/u.test(stripNames(spoken, names))) problems.push(`seslendirmede rakam: ${spoken}`);
  const limit = Math.floor((scene.durationInFrames / FPS) * WORDS_PER_SECOND);
  if (wordCount(spoken) > limit) problems.push(`seslendirme ${wordCount(spoken)} sözcük: ${scene.durationInFrames / FPS} sn için en fazla ${limit}`);
  const longest = Math.max(0, ...bullets.map((bullet) => wordCount(bullet.text)));
  if (bullets.length && wordCount(voice.text) <= longest) problems.push("seslendirme ekrandaki maddeden uzun değil");
  return problems;
}

export function readabilityProblems(script: Pick<ReelScript, "scenes" | "meta">): string[] {
  const names = [script.meta.teams.home.name, script.meta.teams.home.shortName, script.meta.teams.away.name, script.meta.teams.away.shortName];
  return script.scenes.flatMap((scene) => sceneReadabilityProblems(scene, names).map((problem) => `${scene.type}: ${problem}`));
}

/** Tam analist notu kartın süresine sığmıyorsa kaç sözcük taştığı: panelde uyarıdır, render'ı durdurmaz. */
export function noteOverrun(scene: ReelScene): number {
  if (!scene.voiceover?.lines.some((line) => line.sources.includes("analyst_note"))) return 0;
  return Math.max(0, wordCount(scene.voiceover.text) - Math.floor((scene.durationInFrames / FPS) * WORDS_PER_SECOND));
}
