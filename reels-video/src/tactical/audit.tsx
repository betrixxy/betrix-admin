import { useEffect } from "react";
import { cancelRender, continueRender, delayRender, useCurrentFrame } from "remotion";
import { GAP } from "./parts";

/**
 * Kare başına yerleşim (tarayıcıda, gerçek kutular; kullanıcı 2026-11-07), ekran görüntüsünden ÖNCE:
 *   0. Kısma (düzeltme 2): panellerin altına önce kamera kadrajıyla nokta düşürülmez (`framing.ts`); yine de bir kutuya (`data-box`,
 *      8 px pay) değen oyuncu noktası o karede %20 opaklığa iner (`data-under`; kaybolmaz). Her karede önce işaretler kaldırılır.
 *   1. Denetim (`audit`): görünen her `data-box` çifti arasında en az 24 px boşluk (iç içe değilse); çakışma ya da dar aralık → ihlal.
 *   2. Denetim: bir kutunun arkasında %20'den opak nokta numarası olamaz.
 * Günlüğe kutular ve noktalar da yazılır (kontrast denetimi ve kadraj doğrulaması bu kutuları kullanır).
 * İhlal varsa günlüğe yazılır ve render durdurulur (`cancelRender`).
 */

export const LAYOUT_PREFIX = "TACTICAL_LAYOUT:";
const DOT_MARGIN = 8;
/** Panel altındaki noktanın opaklığı. */
export const UNDER_OPACITY = 0.2;
/** Kökte bir kez: işaretli nokta %20 (satır içi opaklığı ezer). */
export const UNDER_CSS = `[data-under="1"]{opacity:${UNDER_OPACITY} !important}`;

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

/** Kutuya değen noktaları %20'ye indirir; kısılan nokta sayısını döner. */
export function dimDots(root: Element): number {
  const dots = [...root.querySelectorAll<HTMLElement>("[data-dot]")];
  for (const dot of dots) dot.parentElement?.removeAttribute("data-under");
  const boxes = visibleBoxes(root);
  let dimmed = 0;
  for (const dot of dots) {
    const rect = grow(read(dot, "nokta"), DOT_MARGIN);
    if (boxes.some((item) => gapBetween(rect, item).overlap) && dot.parentElement) { dot.parentElement.setAttribute("data-under", "1"); dimmed += 1; }
  }
  return dimmed;
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
  for (const dot of dots) for (const item of boxes) if (gapBetween(dot, item).overlap && dot.opacity > UNDER_OPACITY + 0.01) issues.push(`nokta ${dot.name} (%${Math.round(dot.opacity * 100)}) → ${item.name} arkasında`);
  return issues;
}

export function TacticalLayout({ audit }: { audit: boolean }) {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender("taktik yerleşim");
    void document.fonts.ready.then(() => {
      const root = document.querySelector("[data-tactical-root]");
      if (!root) { cancelRender(new Error("taktik kök yok")); return; }
      const dimmed = dimDots(root);
      if (audit) {
        const issues = auditLayout(root);
        const round = (item: Box) => ({ name: item.name, x: Math.round(item.x), y: Math.round(item.y), w: Math.round(item.w), h: Math.round(item.h) });
        const dots = [...root.querySelectorAll("[data-dot]")].map((element) => read(element, element.getAttribute("data-dot") ?? "nokta")).filter((item) => item.opacity > 0.02).map(round);
        console.log(LAYOUT_PREFIX + JSON.stringify({ frame, dimmed, boxes: visibleBoxes(root).filter((item) => item.name !== "kayan-şerit").map(round), dots, issues }));
        if (issues.length) { cancelRender(new Error(`yerleşim ihlali, kare ${frame}: ${issues.join(" | ")}`)); return; }
      }
      continueRender(handle);
    });
  }, [frame, audit]);
  return null;
}
