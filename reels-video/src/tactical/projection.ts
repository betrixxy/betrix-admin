import { PITCH } from "./camera";
import type { Camera } from "./types";

/**
 * Saha düzlemindeki bir noktanın ekran konumu — `Board.tsx`'teki CSS 3D ile aynı hesap (kadraj eniyileme için; tarayıcı gerekmez).
 * Kap: 1080×1920, `perspective: 1700`, `perspective-origin: 50% 40%`. Saha: sol 100, üst 280, 880×1360, dönüşüm merkezi sahanın
 * ortası; `translate(panX, panY) rotateX(tilt) rotateZ(rotate) scale(zoom)` (CSS sağdan sola uygular).
 */

export const SCREEN = { width: 1080, height: 1920 } as const;
const PERSPECTIVE = 1700;
const ORIGIN = { x: SCREEN.width * 0.5, y: SCREEN.height * 0.4 };
const CENTER = { x: SCREEN.width / 2, y: SCREEN.height / 2 };

export interface ScreenPoint { x: number; y: number; scale: number }

export function project(camera: Camera, local: { x: number; y: number }): ScreenPoint {
  let x = (local.x - PITCH.width / 2) * camera.zoom;
  let y = (local.y - PITCH.height / 2) * camera.zoom;
  const r = (camera.rotate * Math.PI) / 180;
  [x, y] = [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
  const t = (camera.tilt * Math.PI) / 180;
  const z = y * Math.sin(t);
  y = y * Math.cos(t);
  const worldX = CENTER.x + x + camera.panX;
  const worldY = CENTER.y + y + camera.panY;
  const k = PERSPECTIVE / (PERSPECTIVE - z);
  return { x: ORIGIN.x + (worldX - ORIGIN.x) * k, y: ORIGIN.y + (worldY - ORIGIN.y) * k, scale: k * camera.zoom };
}

/** Oyuncu noktasının ekrandaki kutusu: 68 px karenin dört köşesi ayrı izdüşürülür (yakın noktada perspektif alt kenarı büyütür). */
export function dotRect(camera: Camera, local: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
  const corners = [[-34, -34], [34, -34], [-34, 34], [34, 34]].map(([dx = 0, dy = 0]) => project(camera, { x: local.x + dx, y: local.y + dy }));
  const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
