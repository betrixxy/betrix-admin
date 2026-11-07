import { Easing, interpolate } from "remotion";
import type { Beat, Camera } from "./types";

/** Kamera geçişi: beat başında önceki durumdan yenisine 15 karede (12–18 aralığı), yumuşak giriş/çıkış. */
export const CAMERA_FRAMES = 15;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

export const PITCH = { width: 880, height: 1360 } as const;

const mix = (a: Camera, b: Camera, t: number): Camera => ({
  tilt: a.tilt + (b.tilt - a.tilt) * t,
  zoom: a.zoom + (b.zoom - a.zoom) * t,
  panX: a.panX + (b.panX - a.panX) * t,
  panY: a.panY + (b.panY - a.panY) * t,
  rotate: a.rotate + (b.rotate - a.rotate) * t,
});

export function activeBeat(beats: readonly Beat[], frame: number): number {
  let index = 0;
  beats.forEach((beat, at) => { if (frame >= beat.from) index = at; });
  return index;
}

export function cameraAt(beats: readonly Beat[], frame: number): Camera {
  const index = activeBeat(beats, frame);
  const beat = beats[index];
  if (!beat) return { tilt: 30, zoom: 1, panX: 0, panY: 0, rotate: 0 };
  const previous = beats[index - 1];
  if (!previous) return beat.camera;
  const t = interpolate(frame - beat.from, [0, CAMERA_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return mix(previous.camera, beat.camera, t);
}

/**
 * Beat'in görünürlüğü: önceki katman 4 karede söner, yenisi 2. karede belirmeye başlar ve 7. karede tam görünür (rakam ≤ 6 kare
 * kuralı; iki katman üst üste hayalet bırakmaz). Saha ve kamera kesintisiz sürer.
 */
export function beatPresence(beat: Beat, next: Beat | undefined, frame: number): number {
  const local = frame - beat.from;
  if (local < 0) return 0;
  const fadeIn = beat.from === 0 ? 1 : interpolate(local, [1, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const end = next ? next.from : beat.from + beat.duration;
  const fadeOut = next ? interpolate(frame, [end, end + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return Math.min(fadeIn, fadeOut);
}

/** Sayaç: 0'dan hedefe 10 karede, son karede tam değer. */
export function countTo(value: number, local: number, frames = 10): number {
  if (local <= 0) return 0;
  if (local >= frames) return value;
  const t = 1 - (1 - local / frames) ** 3;
  return Math.round(value * t);
}
