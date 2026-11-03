import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Figures, Panel, QuestionTitle, themeOf, titleBottom } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, W, X } from "../design/tokens";
import { formatInt, seeded } from "../lib/motion";
import type { SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PLAY_FROM = 14;
const PLAY_TO = 150;

/**
 * Monte Carlo kartı: skorborddan maçlar art arda geçer, üç sayaç yükselir, yüzdeler dalgalanıp gerçek değerde oturur.
 * Son karede sayaçlar N × pay, yüzdeler verideki değerdir. Örnek skorlar akıştır, tek tek iddia değildir.
 */
export function MonteCarloScene({ script, scene }: SceneProps<"M02_MONTE_CARLO">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const { home, away } = script.meta.teams;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 10;
  const progress = interpolate(frame, [PLAY_FROM, PLAY_TO], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const played = Math.round(data.simulations * progress);
  const done = frame >= PLAY_TO;
  // Skor önce yavaş, sonra hızlı değişir.
  const sampleIndex = Math.min(data.samples.length - 1, Math.floor(progress ** 0.6 * (data.samples.length - 1)));
  const sample = data.samples[sampleIndex] ?? { home: 0, away: 0 };
  const rows = [
    { key: "home" as const, label: home.shortName, color: home.colors.primary, logo: home.logo },
    { key: "draw" as const, label: "Beraberlik", color: "#A8B2AE", logo: null },
    { key: "away" as const, label: away.shortName, color: away.colors.primary, logo: away.logo },
  ];
  const noise = (index: number) => (seeded(Math.floor(frame / 3) * 7 + index) - 0.5) * 14 * (1 - progress);
  const shown = (key: "home" | "draw" | "away", index: number) => (done ? data.final[key] : Math.max(1, Math.min(99, Math.round(data.final[key] + noise(index)))));
  const count = (key: "home" | "draw" | "away") => Math.round(played * data.shares[key]);
  const leader = rows.reduce((best, row) => (data.final[row.key] > data.final[best.key] ? row : best));
  const heroSize = Math.max(160, Math.min(theme.heroSize, 176));
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <Panel theme={theme} name="skorbord" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px" }}>
          <Img src={staticFile(home.logo)} style={{ width: 72, height: 72 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            {/* Akış bitince skor kalkar: son örnek skor tahmin gibi okunmasın. */}
            <div data-support="" style={{ ...numberStyle(theme, 92), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={done ? formatInt(data.simulations) : `${sample.home}–${sample.away}`} /></div>
            <div style={{ ...labelStyle(theme, 30), color: theme.ink, whiteSpace: "nowrap" }}>{done ? "maç oynandı" : <><Figures theme={theme} text={formatInt(played)} /> maç oynandı</>}</div>
          </div>
          <Img src={staticFile(away.logo)} style={{ width: 72, height: 72 }} />
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row, index) => {
            const value = shown(row.key, index);
            const isLeader = done && row.key === leader.key;
            return (
              <div key={row.key} data-block={`sonuç ${row.label}`} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", height: heroSize + 8, padding: "0 16px", background: theme.panel, overflow: "hidden", borderRadius: theme.id === "E" ? 18 : 0 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, background: isLeader ? theme.accent : row.color, opacity: isLeader ? 0.34 : 0.22 }} />
                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ ...labelStyle(theme, 40), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.titleUpper ? "uppercase" : "none" }}>{row.label}</div>
                  <div style={{ ...labelStyle(theme, 30), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={formatInt(count(row.key))} /></div>
                </div>
                <div data-hero="" style={{ ...numberStyle(theme, heroSize), position: "relative", color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={`%${value}`} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
