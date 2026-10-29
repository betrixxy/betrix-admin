import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import sharp from "sharp";
import { loadDeepAnalysisFonts } from "@/lib/dashboard/deep-analysis-fonts";
import { legibleMonoStyle, legibleMonoTree, MONO_BOLD_MIN_PX, MONO_FAMILY } from "@/skills/render-engine/satori-mono";
import { renderSatori } from "@/skills/render-engine/satori-text";

/**
 * Space Mono küçük punto N harfi (2026-10-29 denetimi: "TRE N DYOL", "TEK N İK", "KO N YASPOR"). Bold'un
 * N'si etiket puntosunda dolu blok çiziliyordu; küçük Space Mono Regular'a çevrilir (`satori-mono.ts`).
 */

describe("legibleMonoStyle", () => {
  it("küçük Space Mono Bold → Regular", () => {
    assert.equal(legibleMonoStyle({ fontFamily: MONO_FAMILY, fontWeight: 700, fontSize: 13 })?.fontWeight, 400);
  });
  it("büyük punto, başka font ve Regular dokunulmaz", () => {
    const big = { fontFamily: MONO_FAMILY, fontWeight: 700, fontSize: MONO_BOLD_MIN_PX };
    assert.equal(legibleMonoStyle(big), big);
    const other = { fontFamily: "Manrope", fontWeight: 800, fontSize: 12 };
    assert.equal(legibleMonoStyle(other), other);
  });
  it("font ailesi ve punto üst öğeden miras alınır", () => {
    const tree = legibleMonoTree(createElement("div", { style: { fontFamily: MONO_FAMILY, fontSize: 12 } }, createElement("span", { style: { fontWeight: 700 } }, "TEKNİK"))) as ReactElement<{ children: ReactElement<{ style: { fontWeight: number } }>[] }>;
    const span = [tree.props.children].flat()[0]!;
    assert.equal(span.props.style.fontWeight, 400);
  });
});

/** "HNH" çizer; N harfinin mürekkep kutusu doluluğu (0–1). Bold'da ~0,7 (blok), Regular'da ≤ ~0,53. */
async function nInkDensity(fontSize: number): Promise<number> {
  const fonts = await loadDeepAnalysisFonts();
  const element = createElement(
    "div",
    { style: { display: "flex", background: "#000", color: "#fff", width: 200, height: 60, padding: 10 } },
    createElement("span", { style: { fontFamily: MONO_FAMILY, fontWeight: 700, fontSize, letterSpacing: 3 } }, "HNH"),
  );
  const png = Buffer.from(await renderSatori(element, { width: 200, height: 60, fonts }).arrayBuffer());
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => data[y * info.width + x]!;
  const runs: number[][] = [];
  for (let x = 0; x < info.width; x++) {
    let on = false;
    for (let y = 0; y < info.height && !on; y++) on = px(x, y) > 40;
    if (!on) continue;
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1] === x - 1) run.push(x);
    else runs.push([x]);
  }
  assert.equal(runs.length, 3, "üç harf ayrı çizilmeli");
  const n = runs[1]!;
  let top = info.height;
  let bottom = 0;
  for (const x of n) for (let y = 0; y < info.height; y++) if (px(x, y) > 40) [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
  let sum = 0;
  for (const x of n) for (let y = top; y <= bottom; y++) sum += px(x, y);
  return sum / (255 * n.length * (bottom - top + 1));
}

describe("Space Mono N harfi kart puntosunda açık", () => {
  for (const size of [11, 13, 15, 17, 19]) {
    it(`${size} px — N dolu blok değil`, async () => {
      const density = await nInkDensity(size);
      assert.ok(density < 0.6, `N doluluğu ${density.toFixed(2)} (Bold blok ≈ 0,7)`);
    });
  }
});
