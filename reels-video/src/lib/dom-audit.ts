import { insideSafeArea, MIN_FONT_PX, rectsOverlap, type LayoutAudit, type NamedRect, type Rect } from "./layout-check";

/** Tarayıcıda çalışır: o karedeki gerçek kutuları ölçer. Görünmeyen (opaklığı ~0) öğeler sayılmaz. */

export const AUDIT_PREFIX = "REEL_AUDIT:";

const toRect = (rect: DOMRect): Rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });

function visible(element: Element | null): boolean {
  let opacity = 1;
  for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
  return opacity > 0.05;
}

const contains = (outer: Rect, inner: Rect, tolerance = 1): boolean =>
  inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;

/** Satır kutusu yazının kendisinden yüksektir: üst üste satırlar çakışma sayılmasın. */
const inkOf = (rect: Rect): Rect => ({ x: rect.x + 1, y: rect.y + rect.height * 0.2, width: Math.max(0, rect.width - 2), height: rect.height * 0.6 });

export function measureDom(root: Element): LayoutAudit {
  const faces = [...root.querySelectorAll("[data-face]")].filter(visible).map((element) => toRect(element.getBoundingClientRect()));
  const blocks: NamedRect[] = [...root.querySelectorAll("[data-block]")].filter(visible).map((element) => ({ name: element.getAttribute("data-block") ?? "blok", ...toRect(element.getBoundingClientRect()) }));

  const texts: (NamedRect & { parent: Element })[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.textContent?.trim();
    if (!value || !node.parentElement || !visible(node.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    // Satır satır: alt alta sarılan metin tek dev kutu sayılmasın.
    for (const line of range.getClientRects()) {
      if (line.width > 0) texts.push({ name: value.slice(0, 32), parent: node.parentElement, ...toRect(line) });
    }
  }

  const unique = (items: string[]) => [...new Set(items)];
  const textCollisions: string[] = [];
  texts.forEach((a, index) => {
    for (const b of texts.slice(index + 1)) if (rectsOverlap(inkOf(a), inkOf(b))) textCollisions.push(`${a.name} × ${b.name}`);
  });

  return {
    faces: faces.length,
    blocks: blocks.length,
    faceOverlaps: unique([...blocks, ...texts].filter((item) => faces.some((face) => rectsOverlap(face, item))).map((item) => item.name)),
    outsideSafe: unique([...blocks, ...texts].filter((item) => !insideSafeArea(item)).map((item) => item.name)),
    textOverflow: unique(texts.filter((text) => {
      const card = text.parent.closest("[data-block]");
      return card ? !contains(toRect(card.getBoundingClientRect()), text) : false;
    }).map((text) => text.name)),
    tooSmall: unique(texts.filter((text) => Number.parseFloat(getComputedStyle(text.parent).fontSize) < MIN_FONT_PX).map((text) => text.name)),
    textCollisions: unique(textCollisions),
  };
}
