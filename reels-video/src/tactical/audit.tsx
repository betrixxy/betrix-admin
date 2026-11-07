import { useEffect } from "react";
import { cancelRender, continueRender, delayRender, useCurrentFrame } from "remotion";
import { GAP } from "./parts";

/**
 * Kare başına yerleşim (tarayıcıda, gerçek kutular; kullanıcı 2026-11-07), ekran görüntüsünden ÖNCE:
 *   0. Gizleme: bir kutuya (`data-box`, 8 px pay) değen oyuncu noktası o karede tamamen gizlenir — panel kenarından yarım nokta
 *      ya da yazının arkasında numara görünmez. Her karede önce bütün noktalar geri açılır (önceki karenin gizlemesi taşınmaz).
 *   1. Denetim (`audit`): görünen her `data-box` çifti arasında en az 24 px boşluk (iç içe değilse); çakışma ya da dar aralık → ihlal.
 *   2. Denetim: görünen bir nokta hiçbir kutuya değemez (gizleme çalıştıysa bu hiç olmaz; olursa ihlal).
 * İhlal varsa günlüğe yazılır ve render durdurulur (`cancelRender`).
 */

export const LAYOUT_PREFIX = "TACTICAL_LAYOUT:";
const DOT_MARGIN = 8;

interface Box { name: string; x: number; y: number; w: number; h: number; opacity: number }

function opacityOf(element: Element): number {
  let value = 1;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.visibility === "hidden" || style.display === "none") return 0;
    value *= Number(style.opacity);
  }
  return value;
}

const read = (element: Element, name: string): Box => {
  const rect = element.getBoundingClientRect();
  return { name, x: rect.x, y: rect.y, w: rect.width, h: rect.height, opacity: opacityOf(element) };
};

const gapBetween = (a: Box, b: Box) => {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return { overlap: dx === 0 && dy === 0, gap: Math.max(dx, dy) };
};
const inside = (outer: Box, inner: Box) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1;
const grow = (item: Box, by: number): Box => ({ ...item, x: item.x - by, y: item.y - by, w: item.w + 2 * by, h: item.h + 2 * by });

const visibleBoxes = (root: Element) => [...root.querySelectorAll("[data-box]")].map((element) => read(element, element.getAttribute("data-box") ?? "kutu")).filter((item) => item.opacity > 0.02 && item.w > 0 && item.h > 0);

/** Kutuya değen noktaları gizler; gizlenen nokta sayısını döner. */
export function maskDots(root: Element): number {
  const dots = [...root.querySelectorAll<HTMLElement>("[data-dot]")];
  for (const dot of dots) if (dot.parentElement) dot.parentElement.style.visibility = "";
  const boxes = visibleBoxes(root);
  let hidden = 0;
  for (const dot of dots) {
    const rect = grow(read(dot, "nokta"), DOT_MARGIN);
    if (boxes.some((item) => gapBetween(rect, item).overlap) && dot.parentElement) { dot.parentElement.style.visibility = "hidden"; hidden += 1; }
  }
  return hidden;
}

export function auditLayout(root: Element): string[] {
  const boxes = visibleBoxes(root);
  const dots = [...root.querySelectorAll("[data-dot]")].map((element) => read(element, element.getAttribute("data-dot") ?? "nokta")).filter((item) => item.opacity > 0.02);
  const issues: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      if (!a || !b || inside(a, b) || inside(b, a)) continue;
      const { overlap, gap } = gapBetween(a, b);
      if (overlap || gap < GAP) issues.push(`${a.name} ↔ ${b.name}: ${overlap ? "üst üste" : `${gap.toFixed(0)} px`}`);
    }
  }
  for (const dot of dots) for (const item of boxes) if (gapBetween(dot, item).overlap) issues.push(`nokta ${dot.name} → ${item.name} ile kesişiyor`);
  return issues;
}

export function TacticalLayout({ audit }: { audit: boolean }) {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender("taktik yerleşim");
    void document.fonts.ready.then(() => {
      const root = document.querySelector("[data-tactical-root]");
      if (!root) { cancelRender(new Error("taktik kök yok")); return; }
      const hidden = maskDots(root);
      if (audit) {
        const issues = auditLayout(root);
        console.log(LAYOUT_PREFIX + JSON.stringify({ frame, hidden, boxes: visibleBoxes(root).length, issues }));
        if (issues.length) { cancelRender(new Error(`yerleşim ihlali, kare ${frame}: ${issues.join(" | ")}`)); return; }
      }
      continueRender(handle);
    });
  }, [frame, audit]);
  return null;
}
