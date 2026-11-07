import { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { countTo, INTRO } from "./camera";
import { BAND, CAPTION, COUNTER, GREEN, GREEN_TEXT, INK, GLASS, SAFE, SAFE_WIDTH, TICKER, bodyFont, box, labelFont, numberFont, reveal, upper } from "./parts";
import type { TacticalScript } from "./types";

/**
 * Video boyunca sabit katman: logo (sol üst), site (sağ üst, "www.checkmatch.net"; Instagram adı yok), maç bandı, simülasyon sayacı,
 * altyazı, alttaki kayan yasal şerit, gren, vinyet. Beat katmanları bunun ALTINDA çizilir. Kutular `data-box` ile denetlenir.
 */

const LOGO = { width: 194, height: Math.round((194 * 248) / 1269) };
/** Kayan şerit: sağdan sola ~90 px/sn, kesintisiz döngü. */
export const TICKER_SPEED = 90;
const TICKER_FONT = { ...bodyFont, fontWeight: 500, fontSize: 26 } as const;

/** Logoların dönüştüğü küçük maç bandı: girişin iniş bölümünde (`INTRO`) açılır, video boyunca kalır. */
function Band({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [INTRO.settleEnd - 24, INTRO.settleEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div {...box("bant")} style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: BAND.top, height: BAND.height, ...GLASS, borderLeft: `6px solid ${GREEN}`, borderRadius: 6, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, paddingLeft: 14, ...reveal(open) }}>
      <Img src={staticFile(script.home.logo)} style={{ width: 44, height: 44, objectFit: "contain" }} />
      <span style={{ ...numberFont, fontSize: 38, color: INK }}>{upper(script.kickoffLabel)}</span>
      <Img src={staticFile(script.away.logo)} style={{ width: 44, height: 44, objectFit: "contain" }} />
      <span style={{ width: 2, height: 34, background: "rgba(255,255,255,0.35)", marginLeft: 6, marginRight: 6 }} />
      <span style={{ ...labelFont, fontSize: 30, color: INK }}>{upper(script.competitionLabel)}</span>
    </div>
  );
}

/** "100.000 maç simülasyonu" sayacı: inişte köşeye yerleşirken sayar. */
function SimCounter({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [INTRO.settleEnd - 24, INTRO.settleEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const value = countTo(script.simulations, frame - (INTRO.settleEnd - 24), 24);
  return (
    <div {...box("sayaç")} style={{ position: "absolute", left: SAFE.left, top: COUNTER.top, height: COUNTER.height, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10, ...GLASS, borderRadius: 6, padding: "0 12px", ...reveal(open) }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: GREEN }} />
      <span style={{ ...numberFont, fontSize: 30, color: INK, minWidth: 92 }}>{value.toLocaleString("tr-TR")}</span>
      <span style={{ ...labelFont, fontSize: 28, color: "rgba(246,248,244,0.86)" }}>MAÇ SİMÜLASYONU</span>
    </div>
  );
}

const shown = (text: string) => { const clean = text.replace(/[.,:?!]+$/u, ""); return /\.net/iu.test(clean) ? clean : upper(clean); };

/** Kelime kelime altyazı: beat'in sözcükleri en çok 4'lü öbeklerde; konuşulan sözcük yeşil. Kutu opak, şeridin 24 px üstünde biter. */
function Captions({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const spoken = script.words.filter((word) => word.start <= frame);
  const current = spoken[spoken.length - 1];
  if (!current || frame > current.end + 20) return null;
  const beatWords = script.words.filter((word) => word.beat === current.beat);
  const chunks: (typeof beatWords)[] = [];
  for (const word of beatWords) {
    const last = chunks[chunks.length - 1];
    const endsSentence = last && /[.,:?!]$/u.test(last[last.length - 1]?.text ?? "");
    if (!last || last.length >= 4 || endsSentence) chunks.push([word]);
    else last.push(word);
  }
  const chunk = chunks.find((items) => items.includes(current)) ?? [];
  // Tek satır: öbek uzunsa yazı küçülür (Barlow Condensed 800 ≈ 0,5 em/harf; en az 40 px), iki satıra bölünmez.
  const estimate = chunk.reduce((sum, word) => sum + shown(word.text).length * 27, 0) + Math.max(0, chunk.length - 1) * 14;
  const size = Math.max(40, Math.min(54, Math.floor((54 * (SAFE_WIDTH - 60)) / Math.max(1, estimate))));
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: CAPTION.top, height: CAPTION.bottom - CAPTION.top, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div {...box("altyazı")} style={{ ...GLASS, borderRadius: 12, padding: "10px 22px 8px", display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: "0 14px", maxWidth: SAFE_WIDTH, whiteSpace: "nowrap" }}>
        {chunk.map((word) => (
          <span key={`${word.start}-${word.text}`} style={{ ...labelFont, fontSize: size, color: word.start <= frame ? (word === current ? GREEN_TEXT : INK) : "rgba(246,248,244,0.5)" }}>
            {shown(word.text)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Metin genişliği (yüklü yazı tipiyle, tarayıcıda; döngü dikişi için). */
function textWidth(text: string): number {
  if (typeof document === "undefined") return text.length * 13;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return text.length * 13;
  context.font = `${TICKER_FONT.fontWeight} ${TICKER_FONT.fontSize}px ${TICKER_FONT.fontFamily}`;
  return context.measureText(text).width;
}

/** Ekranın görünen en alt çizgisinde (Instagram arayüzünün hemen üstü) tam genişlikte koyu şerit; yasal not + site sağdan sola kayar. */
function Ticker({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const text = `${script.legal}   •   ${script.site}   •   `;
  const width = useMemo(() => textWidth(text), [text]);
  const offset = ((frame / 30) * TICKER_SPEED) % Math.max(1, width);
  const copies = Math.ceil(1080 / Math.max(1, width)) + 2;
  return (
    <div {...box("kayan-şerit")} style={{ position: "absolute", left: 0, width: 1080, top: TICKER.top, height: TICKER.height, background: "#030705", overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", transform: `translateX(${-offset}px)`, whiteSpace: "pre" }}>
        {Array.from({ length: copies }, (_, index) => <span key={index} style={{ ...TICKER_FONT, color: "rgba(255,255,255,0.8)" }}>{text}</span>)}
      </div>
    </div>
  );
}

function Grain() {
  const frame = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 0.035, mixBlendMode: "overlay" }}>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 24} /></filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

export function Hud({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  // İlk kare boş olamaz (düzeltme 2): marka ve site ilk kareden görünür.
  const appear = 1;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
      <Grain />
      {/* Altyazı ve şerit bandı hafif koyulaşır; şeridin altında saha yine görünür (düzeltme 2: alt çeyrek siyah değil). */}
      <div style={{ position: "absolute", left: 0, right: 0, top: CAPTION.top - 60, height: TICKER.top + TICKER.height + 80 - (CAPTION.top - 60), background: "linear-gradient(180deg, rgba(3,7,5,0) 0%, rgba(3,7,5,0.55) 30%, rgba(3,7,5,0.55) 75%, rgba(3,7,5,0) 100%)" }} />
      <div style={{ opacity: appear }}>
        <Img {...box("logo", true)} src={staticFile("brand/checkmatch-logo.png")} style={{ position: "absolute", left: SAFE.left, top: SAFE.top + 6, width: LOGO.width, height: LOGO.height, opacity: 0.8 }} />
        <div {...box("site", true)} style={{ position: "absolute", right: 1080 - SAFE.right, top: SAFE.top + 4, ...bodyFont, fontSize: 30, color: INK }}>{script.site}</div>
      </div>
      {/* Bant ve sayaç saydamlıkla belirmez (altlarında nokta görünmesin): ilk kareden opak. */}
      <Band script={script} />
      <SimCounter script={script} />
      <Captions script={script} />
      <Ticker script={script} />
    </AbsoluteFill>
  );
}
