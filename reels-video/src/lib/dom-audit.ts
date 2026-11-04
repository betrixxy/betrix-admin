import { MIN_BODY_PX, MIN_FILL, MIN_HERO_PX, MIN_LABEL_PX, MIN_LOWER_FILL, MIN_SUPPORT_PX, STRICT_SAFE } from "../design/tokens";
import { MAX_BULLET_WORDS, MAX_BULLETS } from "../story/readability";
import { wordCount } from "../story/speech";
import { coverage, insideSafeArea, MIN_FONT_PX, rectsOverlap, type LayoutAudit, type NamedRect, type Rect } from "./layout-check";
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

  const videoRules: string[] = [];
  let fill: LayoutAudit["fill"];
  if (root.getAttribute("data-video-rules") === "on") {
    const sized = (element: Element) => Number.parseFloat(getComputedStyle(element).fontSize);
    for (const text of texts) {
      const size = sized(text.parent);
      if (size < MIN_LABEL_PX) videoRules.push(`etiket ${size} px < ${MIN_LABEL_PX}: ${text.name}`);
      else if (size < MIN_BODY_PX && wordCount(text.name) >= 4 && !text.parent.closest("[data-label]")) videoRules.push(`gövde ${size} px < ${MIN_BODY_PX}: ${text.name}`);
    }
    const bullets = [...root.querySelectorAll("[data-bullet]")].filter(visible);
    if (bullets.length > MAX_BULLETS) videoRules.push(`${bullets.length} madde > ${MAX_BULLETS}`);
    for (const bullet of bullets) {
      const text = bullet.textContent ?? "";
      if (wordCount(text) > MAX_BULLET_WORDS) videoRules.push(`madde ${wordCount(text)} sözcük: ${text}`);
      if (!/\d/u.test(text)) videoRules.push(`maddede rakam yok: ${text}`);
      if (sized(bullet) < MIN_BODY_PX) videoRules.push(`madde ${sized(bullet)} px: ${text}`);
    }
    for (const note of [...root.querySelectorAll("[data-note]")].filter(visible)) {
      const range = document.createRange();
      range.selectNodeContents(note);
      const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.y))).size;
      if (lines > 2) videoRules.push(`analist notu ${lines} satır > 2`);
    }
    for (const hand of [...root.querySelectorAll("[data-hand]")].filter(visible)) {
      const text = hand.textContent ?? "";
      if (wordCount(text) > 3) videoRules.push(`el yazısı ${wordCount(text)} sözcük: ${text}`);
      if (/\d/u.test(text)) videoRules.push(`el yazısında rakam: ${text}`);
    }
    // El yazısı fontu yalnız işaretli etikette: cümle ve rakam bu fontla yazılmaz.
    for (const text of texts) if (getComputedStyle(text.parent).fontFamily.includes("Caveat") && !text.parent.closest("[data-hand]")) videoRules.push(`el yazısı işaretsiz: ${text.name}`);
    const area: Rect = { x: safe.left, y: safe.top, width: 1080 - safe.left - safe.right, height: 1920 - safe.top - safe.bottom };
    const filled = [...[...root.querySelectorAll("[data-block],[data-title],[data-fill],[data-hero]")].filter(visible).map((element) => toRect(element.getBoundingClientRect())), ...texts];
    const lowerArea: Rect = { ...area, y: area.y + area.height / 2, height: area.height / 2 };
    fill = { total: Number(coverage(filled, area).toFixed(3)), lower: Number(coverage(filled, lowerArea).toFixed(3)) };
    if (fill.total < MIN_FILL) videoRules.push(`doluluk %${Math.round(fill.total * 100)} < %${MIN_FILL * 100}`);
    if (fill.lower < MIN_LOWER_FILL) videoRules.push(`alt yarı doluluk %${Math.round(fill.lower * 100)} < %${MIN_LOWER_FILL * 100}`);
  }

  return {
    videoRules: unique(videoRules),
    fill,
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
