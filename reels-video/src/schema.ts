import { z } from "zod";

/**
 * ReelScript: videonun tek girdisi. Senaryo motoru bunu üretir, render bunu tüketir. Bilinmeyen alan hatadır.
 * Görsel yolları `public/` altına göredir.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB olmalı.");
const percent = z.number().int().min(0).max(100);
const box = z.strictObject({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() });

/** Betrix `Photo.processingMeta` ile aynı oransal değerler (0–1). */
export const reelPhotoSchema = z.strictObject({
  src: z.string().min(1),
  aspect: z.number().positive(),
  side: z.enum(["home", "away"]),
  focus: z.strictObject({ x: z.number(), y: z.number() }),
  faces: z.array(box),
  crops: z.strictObject({ vertical: box, square: box }),
});

const team = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  shortName: z.string().min(1),
  logo: z.string().min(1),
  colors: z.strictObject({ primary: hex, secondary: hex }),
});

const sceneBase = {
  durationInFrames: z.number().int().positive(),
  headline: z.strictObject({ line1: z.string().min(1), line2: z.string().min(1) }).nullable(),
  /** Veri sahnesinin altındaki güvenilirlik satırı görünür mü. */
  trust: z.boolean(),
  caption: z.string().nullable(),
  assets: z.strictObject({ photoIds: z.array(z.string()) }),
};
const scene = <T extends string, D extends z.ZodType>(type: T, data: D) => z.strictObject({ type: z.literal(type), ...sceneBase, data });

const side = z.enum(["home", "away"]);
const pair = <T extends z.ZodType>(value: T) => z.strictObject({ home: value, away: value });

export const compareRowSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  home: z.string(),
  away: z.string(),
  /** Üstün taraf; eşitse null. */
  better: side.nullable(),
});

export const reelSceneSchema = z.discriminatedUnion("type", [
  scene("S01_COVER", z.strictObject({ seriesLabel: z.string(), league: z.string(), round: z.string().nullable(), dateLabel: z.string(), venue: z.string().nullable() })),
  scene("S02_LOGO", z.strictObject({})),
  scene("S03_HOOK", z.strictObject({ simulations: z.number().int().positive(), wins: z.strictObject({ home: z.number().int(), draw: z.number().int(), away: z.number().int() }) })),
  scene("S04_COMPARE", z.strictObject({ form: pair(z.array(z.enum(["G", "B", "M"]))), rows: z.array(compareRowSchema).min(1), summary: z.string() })),
  scene("S05_H2H", z.strictObject({
    matches: z.array(z.strictObject({ date: z.string(), home: z.string(), away: z.string(), score: z.string() })).min(1),
    avgGoals: z.number(), played: z.number().int(), homeWins: z.number().int(), draws: z.number().int(), awayWins: z.number().int(),
  })),
  scene("S06_WINNER", z.strictObject({
    home: percent, draw: percent, away: percent, leader: z.enum(["home", "draw", "away"]),
    dots: z.strictObject({ home: z.number().int(), draw: z.number().int(), away: z.number().int() }),
  })),
  scene("S07_KEY_GAP", z.strictObject({ metric: z.string(), leader: side, leaderValue: z.string(), otherValue: z.string(), sentence: z.string() })),
  scene("S08_GOALS", z.strictObject({ percent, xg: pair(z.number()), h2hAvg: z.number().nullable() })),
  scene("S09_BOTH_SCORE", z.strictObject({ percent, teamChance: pair(percent).nullable(), cleanSheet: pair(percent) })),
  scene("S10_FIRST_GOAL", z.strictObject({ home: percent, away: percent, none: percent })),
  scene("S11_FATIGUE", z.strictObject({ days: pair(z.number().int().nullable()), sentence: z.string() })),
  scene("S12_SCORE", z.strictObject({ scores: z.array(z.strictObject({ label: z.string(), percent })).min(1) })),
  scene("S13_SCORER", z.strictObject({
    leader: side,
    name: z.string(), goals: z.number().int(), xg: z.number(), games: z.number().int(),
    other: z.strictObject({ name: z.string(), goals: z.number().int(), xg: z.number(), games: z.number().int() }).nullable(),
    updated: z.string(),
  })),
  scene("S14_TRACK_RECORD", z.strictObject({
    focus: z.strictObject({ range: z.string(), hitRate: percent, matches: z.number().int() }),
    buckets: z.array(z.strictObject({ range: z.string(), mid: percent, hitRate: percent, matches: z.number().int(), active: z.boolean() })).min(1),
  })),
  scene("S15_CHANCE", z.strictObject({ percent, hitsOfTen: z.number().int().min(0).max(10), statement: z.string() })),
  scene("S16_SUMMARY", z.strictObject({
    outcome: z.strictObject({ home: percent, draw: percent, away: percent }),
    threePlus: percent, bothScore: percent, firstGoal: z.strictObject({ home: percent, away: percent }),
    xg: pair(z.number()), h2hAvg: z.number().nullable(),
    question: z.string(), prompt: z.string(), handle: z.string(),
  })),
]);

export const reelScriptSchema = z.strictObject({
  meta: z.strictObject({
    match: z.strictObject({ id: z.number().int(), kickoffUtc: z.iso.datetime({ offset: true }), kickoffLabel: z.string(), round: z.string().nullable(), venue: z.string().nullable() }),
    league: z.strictObject({ id: z.number().int(), name: z.string().min(1) }),
    teams: z.strictObject({ home: team, away: team }),
    snapshot: z.strictObject({ version: z.number().int().positive(), contractVersion: z.string(), modelVersion: z.string(), computedAt: z.iso.datetime({ offset: true }), computedLabel: z.string(), simulations: z.number().int().positive() }),
  }),
  brand: z.strictObject({ accent: hex, logo: z.string().min(1), mark: z.string().min(1), handle: z.string().min(1) }),
  photos: z.record(z.string(), reelPhotoSchema),
  scenes: z.array(reelSceneSchema).min(1),
  /** Havuzda olup kullanılmayan sahneler ve nedeni: stüdyoda gösterilir. */
  disabled: z.array(z.strictObject({ type: z.string(), reason: z.string() })),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;
export type ReelScene = z.infer<typeof reelSceneSchema>;
export type ReelSceneType = ReelScene["type"];
export type ReelPhoto = z.infer<typeof reelPhotoSchema>;
export type ReelTeam = z.infer<typeof team>;
export type ReelCropBox = z.infer<typeof box>;
export type CompareRow = z.infer<typeof compareRowSchema>;
