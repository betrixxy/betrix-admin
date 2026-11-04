import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Figures, Panel, QuestionTitle, themeOf, titleBottom } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import { convergedAt, PERCENT_THRESHOLD, percentVisible, roundedAt, winLeader, type Outcome3 } from "../lib/convergence";
import { formatInt } from "../lib/motion";
import type { SceneProps } from "./common";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PLAY_FROM = 14;
const PLAY_TO = 150;
const KEYS = ["home", "draw", "away"] as const;
const CHART_HEIGHT = 280;

/** Yakınsama çizgileri: yalnız oynanan kısım çizilir. Çizgi sayaç eşiğini geçince başlar, sonda kazanma ihtimali yüksek taraf vurgulanır. */
function ConvergenceChart({ theme, final, colors, t, startT, done, leader }: { theme: Theme; final: Outcome3; colors: Record<(typeof KEYS)[number], string>; t: number; startT: number; done: boolean; leader: "home" | "away" | null }) {
  const width = W - 60;
  const top = Math.min(95, Math.max(final.home, final.draw, final.away) + 16);
  const bottom = Math.max(0, Math.min(final.home, final.draw, final.away) - 16);
  const xOf = (value: number) => 8 + ((value - startT) / Math.max(1 - startT, 0.01)) * (width - 32);
  const yOf = (value: number) => 10 + ((top - value) / (top - bottom)) * (CHART_HEIGHT - 20);
  const steps = 72;
  const path = (key: (typeof KEYS)[number]) => {
    const points: string[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const at = startT + ((1 - startT) * step) / steps;
      if (at > t) break;
      points.push(`${xOf(at).toFixed(1)},${yOf(Math.min(top, Math.max(bottom, convergedAt(final, at)[key]))).toFixed(1)}`);
    }
    return points.join(" ");
  };
  return (
    <Panel theme={theme} name="yakınsama" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "10px 16px 8px" }}>
      <div data-label="" style={{ ...labelStyle(theme, 34), color: theme.ink, whiteSpace: "nowrap" }}>Simülasyon arttıkça yüzdeler oturuyor</div>
      <svg data-fill="" width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`} style={{ display: "block" }}>
        {KEYS.map((key) => {
          const lead = done && key === leader;
          return <polyline key={key} points={path(key)} fill="none" stroke={colors[key]} strokeWidth={lead ? 11 : 5} strokeOpacity={done && !lead ? 0.5 : 1} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {done && leader ? <circle cx={xOf(1)} cy={yOf(final[leader])} r={15} fill={colors[leader]} stroke="#FFFFFF" strokeWidth={4} /> : null}
      </svg>
    </Panel>
  );
}

/**
 * Monte Carlo kartı: sayaç eşiğe gelene kadar yüzde yok, sonra yüzdeler dalgalanıp nihai değere oturur, altta yakınsama çizgileri.
 * Son karede sayaçlar N × pay, yüzdeler verideki değerdir. Örnek skorlar ve ara yol akıştır, tek tek iddia değildir.
 */
export function MonteCarloScene({ script, scene }: SceneProps<"M02_MONTE_CARLO">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const { home, away } = script.meta.teams;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 10;
  const t = interpolate(frame, [PLAY_FROM, PLAY_TO], [0, 1], clamp);
  const progress = interpolate(frame, [PLAY_FROM, PLAY_TO], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const played = Math.round(data.simulations * progress);
  const done = frame >= PLAY_TO;
  // Skor önce yavaş, sonra hızlı değişir.
  const sampleIndex = Math.min(data.samples.length - 1, Math.floor(progress ** 0.6 * (data.samples.length - 1)));
  const sample = data.samples[sampleIndex] ?? { home: 0, away: 0 };
  const rows = [
    { key: "home" as const, label: home.shortName, color: home.colors.primary },
    { key: "draw" as const, label: "Beraberlik", color: "#A8B2AE" },
    { key: "away" as const, label: away.shortName, color: away.colors.primary },
  ];
  const visible = done || percentVisible(played, data.simulations);
  const shown = roundedAt(data.final, done ? 1 : t);
  const count = (key: (typeof KEYS)[number]) => (done ? Math.round(data.simulations * data.shares[key]) : Math.round((played * shown[key]) / 100));
  const leader = winLeader(data.final);
  // Çizgi, eşiğe gelinen andan başlar: played = N × t².
  const startT = Math.min(1, Math.sqrt(Math.min(PERCENT_THRESHOLD, data.simulations) / data.simulations));
  const heroSize = 160;
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", gap: 8 }}>
        <Panel theme={theme} name="skorbord" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px" }}>
          <Img src={staticFile(home.logo)} style={{ width: 72, height: 72 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            {/* Akış bitince skor kalkar: son örnek skor tahmin gibi okunmasın. */}
            <div data-support="" style={{ ...numberStyle(theme, 76), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={done ? formatInt(data.simulations) : played === 0 ? "–" : `${sample.home}–${sample.away}`} /></div>
            <div data-label="" style={{ ...labelStyle(theme, 34), color: theme.ink, whiteSpace: "nowrap" }}>{done ? "maç oynandı" : <><Figures theme={theme} text={formatInt(played)} /> maç oynandı</>}</div>
          </div>
          <Img src={staticFile(away.logo)} style={{ width: 72, height: 72 }} />
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row) => {
            const value = shown[row.key];
            const isLeader = done && row.key === leader;
            return (
              <div key={row.key} data-block={`sonuç ${row.label}`} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", height: heroSize + 4, padding: "0 16px", background: theme.panel, overflow: "hidden", borderRadius: theme.id === "E" ? 18 : 0 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: visible ? `${value}%` : 0, background: isLeader ? theme.accent : row.color, opacity: isLeader ? 0.34 : 0.22 }} />
                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ ...labelStyle(theme, 40), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.titleUpper ? "uppercase" : "none" }}>{row.label}</div>
                  <div style={{ ...labelStyle(theme, 34), color: theme.ink, whiteSpace: "nowrap" }}>{visible ? <Figures theme={theme} text={formatInt(count(row.key))} /> : "—"}</div>
                </div>
                <div data-hero="" style={{ ...numberStyle(theme, heroSize), position: "relative", color: theme.ink, whiteSpace: "nowrap" }}>{visible ? <Figures theme={theme} text={`%${value}`} /> : "—"}</div>
              </div>
            );
          })}
        </div>
        <ConvergenceChart theme={theme} final={data.final} colors={{ home: home.colors.primary, draw: "#A8B2AE", away: away.colors.primary }} t={done ? 1 : t} startT={startT} done={done} leader={leader} />
      </div>
    </AbsoluteFill>
  );
}
