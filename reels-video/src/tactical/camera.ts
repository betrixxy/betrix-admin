import { Easing, interpolate } from "remotion";
import type { Beat, Camera } from "./types";

/** Kamera geçişi: beat başında önceki durumdan yenisine 15 karede (12–18 aralığı), yumuşak giriş/çıkış. */
export const CAMERA_FRAMES = 15;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

export const PITCH = { width: 880, height: 1360 } as const;

/**
 * Giriş (kullanıcı 2026-11-07, düzeltme 2): 0–1,2 sn net stadyum + logo çarpışması (`INTRO.collide` karesinde VS, 2–3 kare sarsıntı,
 * bas "thump"); 1,2–2,8 sn kamera yukarıdan eğilip taktik tahtasına iner, logolar banda, sayaç köşeye yerleşir.
 */
export const INTRO = { collide: 10, shakeFrames: 3, settleStart: 36, settleEnd: 84 } as const;
/** Girişte tahta kuşbakışı ve uzak: fotoğrafın altında görünmez, iniş sırasında belirir. */
export const INTRO_CAMERA: Camera = { tilt: 4, zoom: 0.7, panX: 0, panY: -420, rotate: 0 };

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
  if (!previous) {
    if (beat.kind !== "hook") return beat.camera;
    const t = interpolate(frame, [INTRO.settleStart, INTRO.settleEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
    return mix(INTRO_CAMERA, beat.camera, t);
  }
  const t = interpolate(frame - beat.from, [0, CAMERA_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return mix(previous.camera, beat.camera, t);
}

/**
 * Beat'in görünürlüğü: önceki katman 3 karede kapanır, yenisi ancak o bitince (3. kare) açılmaya başlar ve 6. karede tam görünür
 * (rakam ≤ 6 kare kuralı). İki beat'in panelleri hiçbir karede aynı anda görünmez (çakışma denetimi). Saha ve kamera kesintisiz.
 */
export function beatPresence(beat: Beat, next: Beat | undefined, frame: number): number {
  const local = frame - beat.from;
  if (local < 0) return 0;
  const fadeIn = beat.from === 0 ? 1 : interpolate(local, [3, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const end = next ? next.from : beat.from + beat.duration;
  const fadeOut = next ? interpolate(frame, [end, end + 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return Math.min(fadeIn, fadeOut);
}

/** Sayaç: 0'dan hedefe 10 karede, son karede tam değer. */
export function countTo(value: number, local: number, frames = 10): number {
  if (local <= 0) return 0;
  if (local >= frames) return value;
  const t = 1 - (1 - local / frames) ** 3;
  return Math.round(value * t);
}
