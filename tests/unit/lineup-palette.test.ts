import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveTemplateStyle, emptyTeamLineup } from "@/lib/dashboard/lineup-draft";
import { contrastRatio, lineupPalette } from "@/lib/dashboard/lineup-palette";
import type { LineupDraft, LogoSwatches } from "@/types/lineup";

const NONE: LogoSwatches = { vibrant: null, darkVibrant: null, lightVibrant: null, muted: null, darkMuted: null, lightMuted: null, chromaticShare: 0 };
/** Kurgu: kırmızı-sarı arma (canlı), lacivert-sarı arma, siyah-beyaz arma (yalnızca gri tonlar). */
const RED_YELLOW: LogoSwatches = { vibrant: "#f2b705", darkVibrant: "#8c1022", lightVibrant: "#f7d66b", muted: "#a5545c", darkMuted: "#4a1c22", lightMuted: "#d8b9a0", chromaticShare: 0.8 };
const NAVY_YELLOW: LogoSwatches = { vibrant: "#f1ac1a", darkVibrant: "#1c4484", lightVibrant: "#e4cc94", muted: "#547cac", darkMuted: "#134785", lightMuted: "#9cafcc", chromaticShare: 0.9 };
const MONOCHROME: LogoSwatches = { ...NONE, darkMuted: "#1e1e1e", lightMuted: "#bdbdbd", muted: "#7a7a7a" };
/** Siyah-beyaz arma + küçük kırmızı detay: Vibrant kırmızıyı seçer ama logonun yalnızca %10'u renkli. */
const MONOCHROME_RED_DETAIL: LogoSwatches = {
  vibrant: "#e40d18",
  darkVibrant: "#dc0812",
  lightVibrant: "#ef7078",
  muted: "#7c7c7c",
  darkMuted: "#444444",
  lightMuted: "#d3a3a6",
  chromaticShare: 0.1,
};

describe("logo paleti", () => {
  for (const [label, swatches, kit] of [
    ["canlı arma", RED_YELLOW, ""],
    ["lacivert arma", NAVY_YELLOW, "#ffffff"],
    ["siyah-beyaz arma", MONOCHROME, ""],
    ["siyah-beyaz arma, kırmızı detay", MONOCHROME_RED_DETAIL, "#000000"],
    ["logo okunamadı, forma rengi var", null, "#ffe600"],
    ["hiçbir renk yok", NONE, ""],
  ] as const) {
    it(`${label}: beyaz metin, vurgu ve numaralar koyu zeminde okunur`, () => {
      const p = lineupPalette(swatches, kit);
      assert.ok(contrastRatio(p.text, p.backgroundTop) >= 12, "isim/başlık ↔ zemin");
      assert.ok(contrastRatio(p.text, p.backgroundBottom) >= 12, "isim/başlık ↔ zemin altı");
      assert.ok(contrastRatio(p.accent, p.backgroundTop) >= 7, "vurgu ↔ zemin");
      assert.ok(contrastRatio(p.muted, p.backgroundTop) >= 4.5, "ikincil metin ↔ zemin");
      assert.ok(contrastRatio(p.kitText, p.kit) >= 4.5, "numara ↔ daire");
      assert.ok(contrastRatio(p.keeperText, p.keeper) >= 4.5, "kaleci numarası ↔ daire");
      assert.notEqual(p.keeper, p.kit, "kaleci kadrodan ayrışır");
    });
  }

  it("zemin logonun koyu rengidir (lacivert arma lacivert kalır, yeşile dönmez)", () => {
    const p = lineupPalette(NAVY_YELLOW, "");
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(p.backgroundTop.slice(i, i + 2), 16));
    assert.ok((b ?? 0) > (r ?? 0) && (b ?? 0) > (g ?? 0), p.backgroundTop);
  });
});

describe("Kahraman Liste kapak kuralı", () => {
  const draft = (home: string, away: string): Pick<LineupDraft, "templateStyle" | "home" | "away"> => ({
    templateStyle: "hero_list",
    home: { ...emptyTeamLineup("Ev"), heroImageUrl: home },
    away: { ...emptyTeamLineup("Dep"), heroImageUrl: away },
  });
  const cutout = "/api/files/generated/cutout-v1-" + "a".repeat(64) + ".png";

  it("iki kapak varsa liste çizilir", () => {
    assert.equal(effectiveTemplateStyle(draft(cutout, cutout)), "hero_list");
  });

  it("bir kapak bile eksikse iki kart da taktik tahtasına düşer", () => {
    assert.equal(effectiveTemplateStyle(draft(cutout, "")), "pitch");
    assert.equal(effectiveTemplateStyle(draft("", "")), "pitch");
  });

  it("taktik tahtası seçimi kapaktan bağımsızdır", () => {
    assert.equal(effectiveTemplateStyle({ ...draft(cutout, cutout), templateStyle: "pitch" }), "pitch");
  });
});

describe("siyah-beyaz arma", () => {
  it("küçük renkli detay paleti ele geçirmez: zemin, vurgu ve numaralar nötr kalır", () => {
    const p = lineupPalette(MONOCHROME_RED_DETAIL, "#000000");
    const saturation = (hex: string) => {
      const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      return (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
    };
    for (const color of [p.backgroundTop, p.accent, p.kit]) assert.ok(saturation(color) < 0.25, color);
  });
});
