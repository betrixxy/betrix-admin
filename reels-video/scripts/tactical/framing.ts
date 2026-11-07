import { playerPoint } from "../../src/tactical/Board";
import { PITCH } from "../../src/tactical/camera";
import { dotRect, project, SCREEN } from "../../src/tactical/projection";
import type { Beat, Camera, Side, TacticalScript } from "../../src/tactical/types";

/**
 * Kadraj (kullanıcı 2026-11-07, düzeltme 2): her beat'in kamerası, panellerin sahanın boş bölgesine (çizgiler var, oyuncu noktası
 * yok) denk geleceği şekilde seçilir. Paneller kameradan bağımsızdır: önce bir ölçüm karesinde gerçek kutular alınır, sonra kamera
 * ızgarada aranır. Kısıtlar: saha ekranın altına kadar uzanır (alt kenar ≥ 1920); beat'e özgü görünmesi gerekenler (gol: üst kale;
 * iki takım: orta saha + üst kale; düello: iki forvet açıkta). Tahta okunur kalır: sahanın üst kenarı ekranın içinde (y 60–760),
 * ekrandaki nokta çapı ≤ 104 px, yakınlaştırma 0,9–1,6, eğim 24–56°. Puan: panel (logo/site satırı dahil) altındaki nokta sayısı ağır,
 * varsayılan kameradan uzaklık hafif ceza. Kapanışta noktalar söndüğü için arama yapılmaz.
 */

export interface Rect { x: number; y: number; w: number; h: number }

const MARGIN = 8;
export const MAX_DOT_PX = 104;
const TOP_EDGE = { min: 60, max: 760 } as const;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + MARGIN && b.x < a.x + a.w + MARGIN && a.y < b.y + b.h + MARGIN && b.y < a.y + a.h + MARGIN;
const onScreen = (p: { x: number; y: number }, pad = 40) => p.x > pad && p.x < SCREEN.width - pad && p.y > pad && p.y < SCREEN.height - pad;

interface DotRef { side: Side; id: number; local: { x: number; y: number } }

function dotsOf(script: TacticalScript): DotRef[] {
  return (["home", "away"] as const).flatMap((side) => (side === "home" ? script.home : script.away).players.map((player) => ({ side, id: player.id, local: playerPoint(player, side) })));
}

export function underPanels(camera: Camera, dots: readonly DotRef[], panels: readonly Rect[]): DotRef[] {
  return dots.filter((dot) => panels.some((panel) => overlaps(dotRect(camera, dot.local), panel)));
}

/** Beat'e özgü zorunlu görünürlük: sağlanmazsa aday elenir. */
function requirementsMet(beat: Beat, camera: Camera, dots: readonly DotRef[], panels: readonly Rect[]): boolean {
  const topGoal = project(camera, { x: PITCH.width / 2, y: 20 });
  const centre = project(camera, { x: PITCH.width / 2, y: PITCH.height / 2 });
  const free = (p: { x: number; y: number }) => onScreen(p) && !panels.some((panel) => overlaps({ x: p.x - 40, y: p.y - 40, w: 80, h: 80 }, panel));
  if (beat.kind === "goals") return free(topGoal);
  if (beat.kind === "both") return onScreen(topGoal) && onScreen(centre);
  if (beat.kind === "duel") {
    const ids = [beat.values.homePlayerId, beat.values.awayPlayerId];
    const forwards = dots.filter((dot) => ids.includes(dot.id));
    return forwards.length === 2 && forwards.every((dot) => free(project(camera, dot.local)));
  }
  return true;
}

const distance = (a: Camera, b: Camera) => Math.abs(a.tilt - b.tilt) / 20 + Math.abs(a.zoom - b.zoom) / 0.4 + Math.abs(a.panX - b.panX) / 300 + Math.abs(a.panY - b.panY) / 400;

export interface FramingResult { kind: Beat["kind"]; camera: Camera; under: number; underBefore: number; searched: number }

export function frameBeat(beat: Beat, script: TacticalScript, panels: readonly Rect[]): FramingResult {
  // Beat'e özgü görünürlük sağlanamıyorsa (ör. iki forvet de panel/kesim dışında olamıyor) en az nokta örten kadraj seçilir.
  const strict = search(beat, script, panels, true);
  return strict.searched && strict.found ? strict.result : search(beat, script, panels, false).result;
}

function search(beat: Beat, script: TacticalScript, panels: readonly Rect[], strictMode: boolean): { result: FramingResult; found: boolean; searched: number } {
  const dots = dotsOf(script);
  const underBefore = underPanels(beat.camera, dots, panels).length;
  if (beat.kind === "close") return { result: { kind: beat.kind, camera: beat.camera, under: underBefore, underBefore, searched: 0 }, found: false, searched: 0 };
  let best: { camera: Camera; score: number; under: number } | null = null;
  let searched = 0;
  for (let tilt = 24; tilt <= 56; tilt += 4) {
    for (let zoom = 0.9; zoom <= 1.61; zoom += 0.05) {
      for (let panY = -600; panY <= 900; panY += 30) {
        for (let panX = -200; panX <= 200; panX += 40) {
          const camera: Camera = { tilt, zoom: Number(zoom.toFixed(2)), panX, panY, rotate: beat.camera.rotate };
          // Saha ekranın altına kadar: alt kenarın iki köşesi ekranın altında ya da üzerinde.
          if (project(camera, { x: 0, y: PITCH.height }).y < SCREEN.height || project(camera, { x: PITCH.width, y: PITCH.height }).y < SCREEN.height) continue;
          // Tahta okunur: üst kenar ekranda, noktalar devleşmez.
          const top = project(camera, { x: PITCH.width / 2, y: 0 }).y;
          if (top < TOP_EDGE.min || top > TOP_EDGE.max) continue;
          if (dots.some((dot) => { const rect = dotRect(camera, dot.local); return rect.y < SCREEN.height && rect.y + rect.h > 0 && rect.w > MAX_DOT_PX; })) continue;
          searched += 1;
          if (strictMode && !requirementsMet(beat, camera, dots, panels)) continue;
          const under = underPanels(camera, dots, panels).length;
          const score = under * 10 + distance(camera, beat.camera);
          if (!best || score < best.score) best = { camera, score, under };
        }
      }
    }
  }
  const result = best ? { kind: beat.kind, camera: best.camera, under: best.under, underBefore, searched } : { kind: beat.kind, camera: beat.camera, under: underBefore, underBefore, searched };
  return { result, found: best !== null, searched };
}
