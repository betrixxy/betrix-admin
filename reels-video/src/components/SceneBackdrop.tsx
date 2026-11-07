import { AbsoluteFill, Img, staticFile } from "remotion";
import type { ReelScript } from "../schema";

/**
 * Sahne zemini: önceden bulanıklaştırılıp karartılmış fotoğraf (`script.backdrops`). Ortak zeminin üstünde, sahne öğelerinin altında;
 * geçişle birlikte kırpılır. Okunurluk karartmayla sağlanır, kontrast denetimi geçmezse çağıran zemini vermez.
 */
export function SceneBackdrop({ script, type }: { script: ReelScript; type: string }) {
  const src = script.backdrops?.[type];
  return src ? <AbsoluteFill><Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></AbsoluteFill> : null;
}
