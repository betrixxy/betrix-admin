import { z } from "zod";

/**
 * ReelScript: videonun tek girdisi. Senaryo motoru (Aşama 4) bu şemayı üretir, render bu şemayı tüketir.
 * Bilinmeyen alan hatadır. Görsel yolları `public/` altına göredir.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB olmalı.");
const percent = z.number().int().min(0).max(100);

const box = z.strictObject({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() });

/** Betrix `Photo.processingMeta` ile aynı oransal değerler (0–1). */
export const reelPhotoSchema = z.strictObject({
  src: z.string().min(1),
  /** Görselin en/boy oranı. */
  aspect: z.number().positive(),
  side: z.enum(["home", "away"]),
  focus: z.strictObject({ x: z.number(), y: z.number() }),
  faces: z.array(box),
  crops: z.strictObject({ vertical: box, square: box }),
});

const team = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  logo: z.string().min(1),
  colors: z.strictObject({ primary: hex, secondary: hex }),
});

const headline = z.strictObject({ line1: z.string().min(1), line2: z.string().min(1) });

const sceneBase = {
  durationInFrames: z.number().int().positive(),
  headline: headline.nullable(),
  caption: z.string().nullable(),
  assets: z.strictObject({ photoIds: z.array(z.string()) }),
};

const scene = <T extends string, D extends z.ZodType>(type: T, data: D) => z.strictObject({ type: z.literal(type), ...sceneBase, data });

export const reelSceneSchema = z.discriminatedUnion("type", [
  scene("K0_COVER", z.strictObject({ seriesLabel: z.string().min(1) })),
  scene("K1_LOGO", z.strictObject({})),
  scene("M1_HOOK", z.strictObject({ simulations: z.number().int().positive() })),
  scene("M3_WINNER", z.strictObject({
    home: percent,
    draw: percent,
    away: percent,
    /** Toplam 1000; 1 nokta = 500 simülasyon. */
    dots: z.strictObject({ home: z.number().int().min(0), draw: z.number().int().min(0), away: z.number().int().min(0) }),
  })),
  scene("M4_GOALS", z.strictObject({ percent, label: z.string().min(1) })),
  scene("M6_FIRST_GOAL", z.strictObject({ home: percent, away: percent, none: percent })),
  scene("K9_CHANCE_NOTE", z.strictObject({ percent, hitsOfTen: z.number().int().min(0).max(10), subject: z.string().min(1), statement: z.string().min(1) })),
  scene("K11_PROMPT", z.strictObject({ prompt: z.string().min(1) })),
  scene("K12_CLOSE", z.strictObject({ handle: z.string().min(1) })),
]);

export const reelScriptSchema = z.strictObject({
  meta: z.strictObject({
    match: z.strictObject({ id: z.number().int(), kickoffUtc: z.iso.datetime({ offset: true }), round: z.string().nullable() }),
    league: z.strictObject({ id: z.number().int(), name: z.string().min(1) }),
    teams: z.strictObject({ home: team, away: team }),
    snapshot: z.strictObject({ version: z.number().int().positive(), contractVersion: z.string(), modelVersion: z.string(), computedAt: z.iso.datetime({ offset: true }) }),
  }),
  brand: z.strictObject({ accent: hex, logo: z.string().min(1), mark: z.string().min(1), handle: z.string().min(1) }),
  photos: z.record(z.string(), reelPhotoSchema),
  scenes: z.array(reelSceneSchema).min(1),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;
export type ReelScene = z.infer<typeof reelSceneSchema>;
export type ReelPhoto = z.infer<typeof reelPhotoSchema>;
export type ReelTeam = z.infer<typeof team>;
export type ReelCropBox = z.infer<typeof box>;
