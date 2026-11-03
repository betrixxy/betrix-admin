import { buildTimeline } from "../lib/motion";
import type { ReelScene, ReelSceneType } from "../schema";
import type { MatchData } from "./match-data";
import { unknownNames } from "./name-guard";
import type { PoolEntry } from "./pool";

/**
 * Hikâye: sabit 17 adımlık akış. Sahne kapalıysa atlanır; hikâye açısı yedek havuzdan uygun olanları ekler.
 * Süre hedefi 75–100 sn. Sıra futbol okumasından tahmine gider: bağlam → veri → soru → senaryo → oyuncu → kapanış.
 */

export type StoryAngle = "derby" | "favourite";

const FLOW: readonly ReelSceneType[] = [
  "S01_COVER", "C01_STORY", "M02_MONTE_CARLO", "C02_FORM", "C03_ABSENCES", "C04_TEAM_HOME", "C05_TEAM_AWAY", "C06_MINUTES",
  "Q04_GOALS", "Q05_BOTH_SCORE", "Q12_FIRST_GOAL", "C07_KEY", "C08_UPSET", "C09_SCENARIO", "P01_DUEL", "P02_VS_OPPONENT", "S17_CLOSE",
];

/** Açıya göre eklenen market sahneleri, tercih sırasıyla. "Sert maç" derbiye, "Rahat galibiyet" favoriye. */
const ANGLE_EXTRAS: Record<StoryAngle, readonly ReelSceneType[]> = {
  derby: ["Q14_CARDS", "Q02_POINTS", "Q13_PRESSURE", "Q08_HT_LEAD", "Q15_PENALTY", "Q03_COMFORT"],
  favourite: ["Q03_COMFORT", "Q02_POINTS", "Q08_HT_LEAD", "Q13_PRESSURE", "Q15_PENALTY", "Q14_CARDS"],
};
/** Her hikâyeye en fazla bu kadar ek girer; süre 75 sn altındaysa sınır aşılır. */
const PLANNED_EXTRAS = 1;

/** Yer değiştirebilen komşu sahneler: akışın anlamını bozmaz. */
const SWAPPABLE: readonly (readonly ReelSceneType[])[] = [["C04_TEAM_HOME", "C05_TEAM_AWAY"], ["Q04_GOALS", "Q05_BOTH_SCORE", "Q12_FIRST_GOAL"], ["C07_KEY", "C08_UPSET"]];

export const MIN_STORY_SCENES = 12;
export const MAX_STORY_SCENES = 20;
export const MIN_STORY_SECONDS = 75;
export const MAX_STORY_SECONDS = 100;

export interface StoryOptions {
  /** Aynı hafta içindeki önceki videoların dizilimleri: aynısı tekrarlanmaz. */
  avoid?: readonly (readonly ReelSceneType[])[];
}

const sameSequence = (a: readonly ReelSceneType[], b: readonly ReelSceneType[]): boolean => a.length === b.length && a.every((type, index) => type === b[index]);
const secondsOf = (scenes: readonly (ReelScene | undefined)[]): number => buildTimeline(scenes.flatMap((scene) => (scene ? [scene.durationInFrames] : []))).total / 30;

export function pickStory(pool: readonly PoolEntry[], angle: StoryAngle, options: StoryOptions = {}): ReelScene[] {
  const ready = new Map(pool.flatMap((entry) => (entry.scene ? [[entry.type, entry.scene] as const] : [])));
  const sequence = FLOW.filter((type) => ready.has(type));
  const extras = ANGLE_EXTRAS[angle].filter((type) => ready.has(type));
  const seconds = () => secondsOf(sequence.map((type) => ready.get(type)));
  // Ekler "İlk gol"den sonra, yorum kartlarından önce girer.
  const insertAt = () => {
    const anchor = sequence.indexOf("C07_KEY");
    return anchor >= 0 ? anchor : Math.max(0, sequence.length - 1);
  };
  extras.forEach((type, index) => {
    const planned = index < PLANNED_EXTRAS && seconds() + (ready.get(type)?.durationInFrames ?? 0) / 30 <= MAX_STORY_SECONDS;
    if (planned || seconds() < MIN_STORY_SECONDS) sequence.splice(insertAt(), 0, type);
  });
  // Aynı dizilim bu hafta kullanıldıysa izinli komşular yer değiştirir. Açılış ve kapanış yerinde kalır.
  const avoid = options.avoid ?? [];
  let chosen = [...sequence];
  if (avoid.some((used) => sameSequence(used, chosen))) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const [a, b] = [sequence[index] as ReelSceneType, sequence[index + 1] as ReelSceneType];
      if (!SWAPPABLE.some((group) => group.includes(a) && group.includes(b))) continue;
      const swapped = [...sequence];
      [swapped[index], swapped[index + 1]] = [b, a];
      if (!avoid.some((used) => sameSequence(used, swapped))) {
        chosen = swapped;
        break;
      }
    }
  }
  return chosen.flatMap((type) => {
    const scene = ready.get(type);
    return scene ? [scene] : [];
  });
}

const REQUIRED: readonly [ReelSceneType, string][] = [["M02_MONTE_CARLO", "Monte Carlo"], ["C01_STORY", "Maçın hikâyesi"], ["C09_SCENARIO", "checkmatch senaryosu"], ["P01_DUEL", "Düello"]];

/** Yayın öncesi engeller; panelde gösterilir. Boş dizi = video üretilebilir. Ad bekçisi veride olmayan özel adı burada yakalar. */
export function storyProblems(story: readonly ReelScene[], data: MatchData, seconds: number): string[] {
  const types = story.map((scene) => scene.type);
  const problems = REQUIRED.flatMap(([type, label]) => (types.includes(type) ? [] : [`${label} sahnesi yok`]));
  if (story.length < MIN_STORY_SCENES || story.length > MAX_STORY_SCENES) problems.push(`Sahne sayısı ${story.length}: ${MIN_STORY_SCENES}–${MAX_STORY_SCENES} olmalı`);
  if (seconds < MIN_STORY_SECONDS || seconds > MAX_STORY_SECONDS) problems.push(`Süre ${seconds.toFixed(1)} sn: ${MIN_STORY_SECONDS}–${MAX_STORY_SECONDS} olmalı`);
  const names = unknownNames(story, data);
  if (names.length) problems.push(`Veride olmayan özel ad: ${names.join(", ")}`);
  return problems;
}
