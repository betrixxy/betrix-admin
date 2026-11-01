import type { ReelPhoto, ReelScene, ReelSceneType, ReelScript } from "../schema";

export interface SceneProps<T extends ReelSceneType> {
  script: ReelScript;
  scene: Extract<ReelScene, { type: T }>;
}

export function photoOf(script: ReelScript, ids: readonly string[], side: "home" | "away"): ReelPhoto | null {
  for (const id of ids) {
    const photo = script.photos[id];
    if (photo?.side === side) return photo;
  }
  return null;
}
