import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CAMERA_FRAMES, countTo } from "./camera";
import { GREEN, GREEN_TEXT, INK, labelFont, numberFont, PANEL, SAFE, SAFE_WIDTH, bodyFont, upper } from "./parts";
import type { TacticalScript } from "./types";

/**
 * Video boyunca sabit katman: logo (sol üst), site + hesap (sağ üst), maç bandı, simülasyon sayacı, altyazı, yasal not, gren, vinyet.
 * Hepsi güvenli alanda, ilk 0,3 sn'de belirir. Beat katmanları bunun ALTINDA çizilir: hiçbir şey bunların üstüne binmez.
 */

const LOGO = { width: 194, height: Math.round((194 * 248) / 1269) };

function Band({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const shrinkAt = script.beats[1]?.from ?? script.durationInFrames;
  const t = interpolate(frame, [shrinkAt, shrinkAt + CAMERA_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const big = interpolate(frame, [shrinkAt, shrinkAt + 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {/* Büyük bant: hook'ta içerik alanının altında. */}
      <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: 1120 - t * 120, height: 160, opacity: big, background: PANEL, borderTop: `5px solid ${GREEN}`, borderRadius: 10, display: big > 0.01 ? "flex" : "none", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <Img src={staticFile(script.home.logo)} style={{ width: 92, height: 92, objectFit: "contain" }} />
          <span style={{ ...numberFont, fontSize: 64, color: INK }}>{upper(script.kickoffLabel)}</span>
          <Img src={staticFile(script.away.logo)} style={{ width: 92, height: 92, objectFit: "contain" }} />
        </div>
        <span style={{ ...labelFont, fontSize: 36, color: INK }}>{upper(script.competitionLabel)}</span>
      </div>
      {/* Küçük bant: logonun altında sonuna kadar. */}
      <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: 324, height: 60, opacity: t, background: PANEL, borderLeft: `6px solid ${GREEN}`, borderRadius: 6, display: t > 0.01 ? "flex" : "none", alignItems: "center", gap: 14, paddingLeft: 14 }}>
        <Img src={staticFile(script.home.logo)} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ ...numberFont, fontSize: 38, color: INK }}>{upper(script.kickoffLabel)}</span>
        <Img src={staticFile(script.away.logo)} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ width: 2, height: 34, background: "rgba(255,255,255,0.35)", marginLeft: 6, marginRight: 6 }} />
        <span style={{ ...labelFont, fontSize: 30, color: INK }}>{upper(script.competitionLabel)}</span>
      </div>
    </>
  );
}

function SimCounter({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const hook = script.beats[0];
  const value = hook ? countTo(script.simulations, frame - hook.from, 24) : script.simulations;
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: 394, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: GREEN }} />
      <span style={{ ...numberFont, fontSize: 30, color: INK, minWidth: 92 }}>{value.toLocaleString("tr-TR")}</span>
      <span style={{ ...labelFont, fontSize: 28, color: "rgba(246,248,244,0.86)" }}>MAÇ SİMÜLASYONU</span>
    </div>
  );
}

/** Kelime kelime altyazı: beat'in sözcükleri en çok 4'lü öbeklerde; konuşulan sözcük yeşil. */
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
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, bottom: 1920 - 1396, display: "flex", justifyContent: "center" }}>
      <div style={{ background: "rgba(4,8,6,0.82)", borderRadius: 12, padding: "10px 22px 8px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 14px", maxWidth: SAFE_WIDTH }}>
        {chunk.map((word) => (
          <span key={`${word.start}-${word.text}`} style={{ ...labelFont, fontSize: 54, color: word.start <= frame ? (word === current ? GREEN_TEXT : INK) : "rgba(246,248,244,0.5)" }}>
            {/\.net/iu.test(word.text) ? word.text.replace(/[.,:?!]+$/u, "") : upper(word.text.replace(/[.,:?!]+$/u, ""))}
          </span>
        ))}
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
  const appear = interpolate(frame, [0, 9], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
      <Grain />
      <div style={{ opacity: appear }}>
        <Img src={staticFile("brand/checkmatch-logo.png")} style={{ position: "absolute", left: SAFE.left, top: SAFE.top + 6, width: LOGO.width, height: LOGO.height, opacity: 0.8 }} />
        <div style={{ position: "absolute", right: 1080 - SAFE.right, top: SAFE.top, textAlign: "right" }}>
          <div style={{ ...bodyFont, fontSize: 30, color: INK }}>checkmatch.net</div>
          <div style={{ ...bodyFont, fontWeight: 500, fontSize: 22, color: "rgba(246,248,244,0.82)" }}>@checkmatch_tr</div>
        </div>
        <Band script={script} />
        <SimCounter script={script} />
      </div>
      {/* Altyazı ve yasal notun arkası: saha noktaları yazının altında kalır. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1270, height: 260, background: "linear-gradient(180deg, rgba(3,7,5,0) 0%, rgba(3,7,5,0.88) 22%, rgba(3,7,5,0.92) 100%)" }} />
      <Captions script={script} />
      <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, bottom: 1920 - SAFE.bottom, textAlign: "center", ...bodyFont, fontWeight: 500, fontSize: 22, lineHeight: 1.25, color: "#FFFFFF", opacity: 0.7, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
        {script.legal}
      </div>
    </AbsoluteFill>
  );
}
