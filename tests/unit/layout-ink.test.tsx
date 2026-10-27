import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { checkLayout, dilate, findInkTouches, type InkMask } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { renderSatori } from "@/skills/render-engine/satori-text";
import { layerOpacity, type BlockFilter, type LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { BODY, DISPLAY, DISPLAY_DESCENT_EM } from "@/skills/render-engine/templates/match-day/shared";

/**
 * Yerleşim kapısı mürekkebi ölçer (2026-10-27 hatası: Kura A 02 "FENERBAHÇE" başlığının Ç kuyruğu alt
 * satıra biniyordu; başlık ve alt satır tek blok olduğu için yakalanmadı). Eski aralık yeniden kurulup
 * kapının artık yakaladığı, yeni aralığın geçtiği gösterilir.
 */

const FRAME = MATCH_DAY_FRAMES.IG_PORTRAIT;
const TITLE = 92;

async function png(element: React.ReactElement): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  return sharp(Buffer.from(await renderSatori(element, { width: FRAME.width, height: FRAME.height, fonts }).arrayBuffer())).ensureAlpha().png().toBuffer();
}

/** Başlık + alt satır ayrı bloklar; `gap`: başlık satır kutusunun altından alt satıra. */
function titlePage(title: string, gap: number, only?: BlockFilter) {
  const show = (id: LayoutBlockId) => (only && only !== id ? 0 : 1);
  return (
    <div style={{ display: "flex", position: "relative", width: FRAME.width, height: FRAME.height }}>
      <span style={{ position: "absolute", left: 64, top: 200, fontFamily: DISPLAY, fontSize: TITLE, lineHeight: 1, color: "#fff", opacity: show("draw-hero") }}>{title}</span>
      <span style={{ position: "absolute", left: 64, top: 200 + TITLE + gap, fontFamily: BODY, fontWeight: 800, fontSize: 22, lineHeight: 1, letterSpacing: 4, color: "#fff", opacity: show("draw-subtitle") }}>8 RAKİP · 4 İÇ SAHA · 4 DEPLASMAN</span>
    </div>
  );
}

/** Liste satırı: ad (katman draw-names) ve hemen altında satır (draw-lines). */
function row(name: string, gap: number, only?: BlockFilter) {
  return (
    <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 120, top: 500 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 40, lineHeight: 1, color: "#fff", opacity: layerOpacity(only, "draw-names") }}>{name}</span>
      <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: 17, lineHeight: 1, letterSpacing: 3, color: "#fff", marginTop: gap, opacity: layerOpacity(only, "draw-lines") }}>DEPLASMAN · 3. TORBA</span>
    </div>
  );
}

describe("yerleşim kapısı — mürekkep (kuyruk/nokta)", () => {
  it("eski aralık (14px): Ç kuyruğu alt satırla çakışıyor → kapı yakalar", async () => {
    const report = await checkLayout(FRAME, (only) => png(titlePage("FENERBAHÇE", 14, only)), ["draw-hero", "draw-subtitle"]);
    assert.deepEqual(report.issues.map((issue) => [issue.kind, issue.kind === "OUTSIDE_SAFE" ? null : issue.b]), [["OVERLAP", "draw-subtitle"]]);
  });

  it("kuyruksuz ad aynı aralıkta geçer; yeni aralık (kuyruk payı + 12) Ç ile de geçer", async () => {
    assert.equal((await checkLayout(FRAME, (only) => png(titlePage("GALATASARAY", 14, only)), ["draw-hero", "draw-subtitle"])).issues.length, 0);
    assert.equal((await checkLayout(FRAME, (only) => png(titlePage("FENERBAHÇE", 24 + 12, only)), ["draw-hero", "draw-subtitle"])).issues.length, 0);
  });

  it("liste satırı (mürekkep katmanı): ŞAHTAR'ın kuyruğu 10px alttaki satıra değiyor → INK_TOUCH; kuyruk payıyla geçer", async () => {
    const page = (gap: number) => (only: LayoutBlockId) => png(<div style={{ display: "flex", position: "relative", width: FRAME.width, height: FRAME.height }}>{row("ŞAHTAR DONETSK", gap, only)}</div>);
    const tight = await checkLayout(FRAME, page(4), ["draw-names", "draw-lines"]);
    assert.equal(tight.issues[0]?.kind, "INK_TOUCH");
    const spaced = await checkLayout(FRAME, page(Math.ceil(40 * DISPLAY_DESCENT_EM) + 8), ["draw-names", "draw-lines"]);
    assert.equal(spaced.issues.length, 0);
  });
});

describe("mürekkep maskesi (saf)", () => {
  const mask = (id: LayoutBlockId, points: [number, number][]): InkMask => {
    const data = new Uint8Array(20 * 20);
    for (const [x, y] of points) data[y * 20 + x] = 1;
    return { id, width: 20, height: 20, data };
  };

  it("genişletme kare komşuluk", () => {
    const grown = dilate(mask("draw-names", [[10, 10]]), 2);
    assert.equal(grown[8 * 20 + 8], 1);
    assert.equal(grown[12 * 20 + 12], 1);
    assert.equal(grown[7 * 20 + 10], 0);
  });

  it("boşluk ≤ aralık → temas; uzak → yok", () => {
    assert.equal(findInkTouches([mask("draw-names", [[5, 5]]), mask("draw-lines", [[5, 9]])], 4).length, 1);
    assert.equal(findInkTouches([mask("draw-names", [[5, 5]]), mask("draw-lines", [[5, 10]])], 4).length, 0);
  });
});
