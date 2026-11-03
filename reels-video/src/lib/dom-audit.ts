import { STRICT_SAFE, MIN_HERO_PX, MIN_SUPPORT_PX } from "../design/tokens";
import { insideSafeArea, MIN_FONT_PX, rectsOverlap, type LayoutAudit, type NamedRect, type Rect } from "./layout-check";
import { SAFE } from "./motion";

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

/** Satır kutusu (fontun içerik alanı) yazının kendisinden yüksektir: yalnız yazının kapladığı bant sayılır. */
const inkOf = (rect: Rect): Rect => ({ x: rect.x + 1, y: rect.y + rect.height * 0.2, width: Math.max(0, rect.width - 2), height: rect.height * 0.6 });

export function measureDom(root: Element): LayoutAudit {
  const safe = root.getAttribute("data-safe") === "strict" ? STRICT_SAFE : SAFE;
  const monoAllowed = root.getAttribute("data-mono-words") === "ok";
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

  const sizeOf = (element: Element) => Number.parseFloat(getComputedStyle(element).fontSize);
  const sizeRule = [
    ...[...root.querySelectorAll("[data-hero]")].filter((element) => visible(element) && sizeOf(element) < MIN_HERO_PX).map((element) => `ana rakam ${sizeOf(element)} px`),
    ...[...root.querySelectorAll("[data-support]")].filter((element) => visible(element) && sizeOf(element) < MIN_SUPPORT_PX).map((element) => `destek ${element.textContent} ${sizeOf(element)} px`),
  ];

  return {
    faces: faces.length,
    blocks: blocks.length,
    faceOverlaps: unique([...blocks, ...texts].filter((item) => faces.some((face) => rectsOverlap(face, item))).map((item) => item.name)),
    outsideSafe: unique([...blocks.filter((item) => !insideSafeArea(item, 1, safe)), ...texts.filter((item) => !insideSafeArea(inkOf(item), 1, safe))].map((item) => item.name)),
    textOverflow: unique(texts.filter((text) => {
      const card = text.parent.closest("[data-block]");
      return card ? !contains(toRect(card.getBoundingClientRect()), inkOf(text)) : false;
    }).map((text) => text.name)),
    tooSmall: unique(texts.filter((text) => Number.parseFloat(getComputedStyle(text.parent).fontSize) < MIN_FONT_PX).map((text) => text.name)),
    textCollisions: unique(textCollisions),
    monoWords: monoAllowed ? [] : unique(texts.filter((text) => getComputedStyle(text.parent).fontFamily.includes("JetBrains") && /\p{L}/u.test(text.name)).map((text) => text.name)),
    sizeRule: unique(sizeRule),
    // Kontrast yazının kendi bölgesinden okunur: satır kutusu yazıdan yüksektir, zemini yanlış sayar.
    samples: texts.map((text) => ({ name: text.name, ...inkOf(text), color: getComputedStyle(text.parent).color })),
  };
}
