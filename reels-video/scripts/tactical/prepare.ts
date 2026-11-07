import { mkdirSync } from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { LAYOUT_PREFIX } from "../../src/tactical/audit";
import { INTRO } from "../../src/tactical/camera";
import { CAPTION, PANEL_ALPHA, SAFE } from "../../src/tactical/parts";
import type { Beat, TacticalScript } from "../../src/tactical/types";
import { boxContrast, MIN_CONTRAST, type BoxContrast, type BoxRect } from "./contrast";
import { frameBeat, type FramingResult } from "./framing";

/**
 * Render öncesi hazırlık (kullanıcı 2026-11-07, düzeltme 2), hafif iş (yalnız tek kareler):
 *   1. Ölçüm: her beat'in temsilî karesi (bütün paneller açıkken) denetimli çizilir, gerçek kutular alınır.
 *   2. Kadraj: kutular sabitken her beat için kamera aranır (`framing.ts`): paneller sahanın boş bölgesine.
 *   3. Kontrast: yeni kamerayla aynı kareler "yazısız" çizilir; ana ve yeşil yazı ≥ 4,5:1 değilse panel saydamlığı 0,58 → 0,70
 *      (0,04 adım) artırılır, 0,70'te de geçmezse sonuç raporlanır (render'ı engellemez; karar kullanıcıda).
 */

interface Logged { frame: number; dimmed: number; boxes: BoxRect[]; dots: BoxRect[]; issues: string[] }

/** Beat'in temsilî karesi: paneller açık, kamera yerleşmiş. Kanca: iniş sonrası + simülasyon paneli; kapanış: liste dolu. */
export function sampleFrame(beat: Beat): number {
  if (beat.kind === "hook") return beat.from + beat.duration - 4;
  if (beat.kind === "close") return beat.from + Number(beat.values.moreAt ?? 0) + 12;
  return beat.from + beat.duration - 4;
}

async function still(serveUrl: string, script: TacticalScript, frame: number, output: string, textless = false): Promise<Logged | null> {
  const inputProps = { script, audit: !textless, textless };
  const composition = await selectComposition({ serveUrl, id: "TacticalReel", inputProps });
  let logged: Logged | null = null;
  await renderStill({ serveUrl, composition, inputProps, frame, output, imageFormat: "png",
    onBrowserLog: ({ text }) => { if (text.includes(LAYOUT_PREFIX)) logged = JSON.parse(text.slice(text.indexOf(LAYOUT_PREFIX) + LAYOUT_PREFIX.length)) as Logged; } });
  return logged;
}

export interface Prepared {
  script: TacticalScript;
  framing: FramingResult[];
  contrast: { alpha: number; frames: { frame: number; kind: string; boxes: BoxContrast[] }[]; minInk: number; minGreen: number; pass: boolean };
  dimmedAfter: { kind: string; dimmed: number }[];
}

export async function prepare(serveUrl: string, input: TacticalScript, dir: string): Promise<Prepared> {
  mkdirSync(dir, { recursive: true });
  // Giriş karesi (net fotoğraf üstünde kanca) de kontrasta girer.
  const samples = [{ kind: "giriş", frame: INTRO.collide + 16 }, ...input.beats.map((beat) => ({ kind: beat.kind, frame: sampleFrame(beat) }))];
  // 1. Ölçüm.
  const measured = new Map<number, BoxRect[]>();
  for (const sample of samples) {
    const logged = await still(serveUrl, input, sample.frame, path.join(dir, `olcum-${sample.kind}.png`));
    measured.set(sample.frame, logged?.boxes ?? []);
  }
  // 2. Kadraj: beat'in panelleri + altyazı şeridi (her an değişen genişlik yerine tam genişlik).
  const captionRect: BoxRect = { name: "altyazı", x: SAFE.left, y: CAPTION.top, w: SAFE.right - SAFE.left, h: CAPTION.bottom - CAPTION.top };
  // Düello: oyuncu kesimleri (başlık ile tablo arası) kutu değil ama noktayı örter; kadrajda engel sayılır.
  const obstacles = (beat: Beat, boxes: BoxRect[]): BoxRect[] => {
    if (beat.kind !== "duel") return [];
    const header = boxes.find((item) => item.name === "başlık");
    const table = boxes.find((item) => item.name === "düello-tablosu");
    return header && table ? [{ name: "kesimler", x: SAFE.left, y: header.y + header.h, w: SAFE.right - SAFE.left, h: table.y - (header.y + header.h) }] : [];
  };
  const framing = input.beats.map((beat) => { const boxes = measured.get(sampleFrame(beat)) ?? []; return frameBeat(beat, input, [...boxes, ...obstacles(beat, boxes), captionRect]); });
  let script: TacticalScript = { ...input, beats: input.beats.map((beat, index) => ({ ...beat, camera: framing[index]?.camera ?? beat.camera })) };
  // 3. Kontrast (yazısız kareler), gerekirse saydamlık artar.
  let result: Prepared["contrast"] | null = null;
  for (let alpha: number = PANEL_ALPHA.base; alpha <= PANEL_ALPHA.max + 1e-9; alpha = Number((alpha + 0.04).toFixed(2))) {
    script = { ...script, panelAlpha: alpha };
    const frames: { frame: number; kind: string; boxes: BoxContrast[] }[] = [];
    for (const sample of samples) {
      const file = path.join(dir, `yazisiz-${sample.kind}.png`);
      await still(serveUrl, script, sample.frame, file, true);
      frames.push({ ...sample, boxes: await boxContrast(file, (measured.get(sample.frame) ?? []).filter((item) => item.name !== "logo" && item.name !== "site")) });
    }
    const all = frames.flatMap((item) => item.boxes);
    const minInk = Math.min(...all.map((item) => item.ink));
    const minGreen = Math.min(...all.map((item) => item.green));
    result = { alpha, frames, minInk, minGreen, pass: minInk >= MIN_CONTRAST && minGreen >= MIN_CONTRAST };
    if (result.pass) break;
  }
  // Son durum: kadrajlı karelerde kısılan nokta sayısı (denetim de bu karelerde koşar).
  const dimmedAfter: { kind: string; dimmed: number }[] = [];
  for (const sample of samples) {
    const logged = await still(serveUrl, script, sample.frame, path.join(dir, `kadraj-${sample.kind}.png`));
    if (logged?.issues.length) throw new Error(`yerleşim ihlali (${sample.kind}): ${logged.issues.join(" | ")}`);
    dimmedAfter.push({ kind: sample.kind, dimmed: logged?.dimmed ?? 0 });
  }
  return { script, framing, contrast: result ?? { alpha: PANEL_ALPHA.base, frames: [], minInk: 0, minGreen: 0, pass: false }, dimmedAfter };
}
