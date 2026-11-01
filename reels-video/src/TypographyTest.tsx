import { useEffect } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { Backdrop } from "./components/Primitives";
import { FONT_FILES, FONTS, GLYPH_TEST } from "./components/typography";
import { BRAND } from "./story/pool";
import type { ReelScript } from "./schema";

export const TYPOGRAPHY_PREFIX = "REEL_TYPE:";

/** Tipografi test karesi: her aile ve kesimde aynı dize. Yüklenen fontu, tabular rakamı ve Türkçe büyütmeyi ölçer. */
export function TypographyTest({ script }: { script: ReelScript }) {
  useEffect(() => {
    const handle = delayRender("tipografi denetimi");
    void document.fonts.ready.then(() => {
      const canvas = document.createElement("canvas").getContext("2d");
      const digitWidths = (family: string, weight: number) => {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;font:${weight} 200px "${family}";font-variant-numeric:tabular-nums`;
        document.body.append(probe);
        const widths = [..."0123456789"].map((digit) => {
          probe.textContent = digit;
          return Math.round(probe.getBoundingClientRect().width * 10) / 10;
        });
        probe.remove();
        return widths;
      };
      const loaded = FONT_FILES.map((font) => ({ family: font.family, weight: font.sample, loaded: document.fonts.check(`${font.sample} 40px "${font.family}"`, GLYPH_TEST) }));
      const upper = document.querySelector("[data-upper]") as HTMLElement | null;
      console.log(TYPOGRAPHY_PREFIX + JSON.stringify({
        loaded,
        canvas: canvas !== null,
        tabularHero: digitWidths(FONTS.display, 900),
        tabularMono: digitWidths(FONTS.mono, 700),
        uppercase: upper?.innerText ?? "",
      }));
      continueRender(handle);
    });
  }, []);
  return (
    <AbsoluteFill lang="tr" style={{ padding: "120px 56px" }}>
      <Backdrop script={script} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 44, color: "#FFFFFF" }}>
        {FONT_FILES.map((font) => (
          <div key={font.file}>
            <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 26, color: "#93A099" }}>{font.family} {font.sample}</div>
            <div style={{ fontFamily: `"${font.family}", monospace`, fontWeight: font.sample, fontSize: 62, lineHeight: 1.15 }}>{GLYPH_TEST}</div>
          </div>
        ))}
        <div>
          <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 26, color: "#93A099" }}>lang=tr büyük harf: kim kazanır, ışığı, iğde</div>
          <div data-upper="" style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 96, textTransform: "uppercase", color: BRAND.accent }}>kim kazanır, ışığı, iğde</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
