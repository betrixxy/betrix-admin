import { formatDecimal } from "../lib/motion";
import type { ReelScene, ReelSceneType } from "../schema";
import type { Voiceover } from "./claims";
import type { Side } from "./match-data";

/** Sahne kuran dosyaların ortak yardımcıları. */

export type Entry = { type: ReelSceneType; scene: ReelScene; reason: null } | { type: ReelSceneType; scene: null; reason: string };
export type Frames = Record<string, number>;

export const NONE = { photoIds: [] as string[] };
export const BOTH = { photoIds: ["home-1", "away-1"] };
export const SIDES = ["home", "away"] as const;
export const other = (side: Side): Side => (side === "home" ? "away" : "home");
export const NO_CONTEXT = "Futbol okuması verisi yok (API-Football)";
export const pct = (value: number) => Math.round(value * 100);
export const key = (side: Side, path: string) => `context.teams.${side}.${path}`;
export const dec = (value: number | null) => (value === null ? null : formatDecimal(value, 1));

export const base = (frames: Frames, type: ReelSceneType, line1: string, line2: string, voiceover: Voiceover | null, assets = NONE) => ({ durationInFrames: frames[type] ?? 150, voiceover, headline: { line1, line2 }, caption: null, assets });
export const on = (scene: ReelScene): Entry => ({ type: scene.type, scene, reason: null });
export const off = (type: ReelSceneType, reason: string): Entry => ({ type, scene: null, reason });
