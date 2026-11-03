import { useEffect } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { StageBackdrop } from "./design/kit";
import { FONT_FILES, FONTS, GLYPH_TEST, NUMBER_FACES } from "./components/typography";
import { BRAND } from "./story/pool";
import type { ReelScript } from "./schema";

export const TYPOGRAPHY_PREFIX = "REEL_TYPE:";

/** Tipografi test karesi: her aile ve kesimde aynı dize. Yüklenen fontu, tabular rakamı ve Türkçe büyütmeyi ölçer. */
export function TypographyTest({ script }: { script: ReelScript }) {
  useEffect(() => {
    const handle = delayRender("tipografi denetimi");
    void document.fonts.ready.then(() => {
      const digitWidths = (family: string, weight: number) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;font:${weight} 200px "${family}";font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1,"lnum" 1`;
        document.body.append(probe);
        const widths = [..."0123456789"].map((digit) => {
          probe.textContent = digit;
          return Math.round(probe.getBoundingClientRect().width * 10) / 10;
        });
        probe.remove();
        return widths;
      };
      const loaded = FONT_FILES.map((font) => ({ family: font.family, weight: font.sample, loaded: document.fonts.check(`${"style" in font ? "italic " : ""}${font.sample} 40px "${font.family}"`, GLYPH_TEST) }));
      const upper = [...document.querySelectorAll("[data-upper]")].map((element) => (element as HTMLElement).innerText);
      console.log(TYPOGRAPHY_PREFIX + JSON.stringify({
        loaded,
        tabular: NUMBER_FACES.map((face) => ({ family: face.family, cellEm: face.cellEm, widths: digitWidths(face.family, face.weight) })),
        uppercase: upper,
      }));
      continueRender(handle);
    });
  }, []);
  return (
    <AbsoluteFill lang="tr" style={{ padding: "60px 56px" }}>
      <StageBackdrop script={script} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, color: "#FFFFFF" }}>
        {FONT_FILES.map((font) => (
          <div key={font.file}>
            <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 24, color: "#C4CEC8" }}>{font.family} {font.sample}</div>
            <div style={{ fontFamily: `"${font.family}", monospace`, fontWeight: font.sample, fontStyle: "style" in font ? "italic" : "normal", fontSize: 50, lineHeight: 1.12, whiteSpace: "nowrap" }}>{GLYPH_TEST}</div>
          </div>
        ))}
        {["Anton", "DM Serif Display", "Unbounded"].map((family) => (
          <div key={family} data-upper="" style={{ fontFamily: family, fontSize: 46, textTransform: "uppercase", color: BRAND.accent, whiteSpace: "nowrap" }}>kim kazanır, ışığı, iğde</div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
