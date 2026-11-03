import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Figures, Panel, QuestionTitle, themeOf, titleBottom, useEnter } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import type { ReelScene, ReelScript } from "../schema";
import type { SceneProps } from "./common";
import { ReasonList } from "./reason-list";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Diziliş: "4-2-3-1" satırları pul olur. Kaleci dahil değil; veride yalnız diziliş adı var, oyuncu adı yazılmaz. */
function FormationBoard({ theme, name, played, color }: { theme: Theme; name: string; played: number; color: string }) {
  const frame = useCurrentFrame();
  const lines = name.split("-").map((part) => Number.parseInt(part, 10)).filter((count) => Number.isFinite(count) && count > 0);
  const width = 300;
  const height = 214;
  const row = height / (lines.length + 1);
  return (
    <Panel theme={theme} name="diziliş" style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 18px" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }}>
        <rect x={3} y={3} width={width - 6} height={height - 6} fill="none" stroke={theme.ink} strokeOpacity={0.5} strokeWidth={3} rx={theme.id === "E" ? 12 : 0} />
        <circle cx={3} cy={height / 2} r={38} fill="none" stroke={theme.ink} strokeOpacity={0.5} strokeWidth={3} />
        {lines.flatMap((count, lineIndex) => Array.from({ length: count }, (_, index) => {
          const x = ((lineIndex + 1) * width) / (lines.length + 1);
          const gap = height / (count + 1);
          const show = interpolate(frame, [20 + lineIndex * 6, 30 + lineIndex * 6], [0, 1], clamp);
          return <circle key={`${lineIndex}-${index}`} cx={x} cy={gap * (index + 1)} r={Math.min(15, row / 3 + 6)} fill={color} stroke="#FFFFFF" strokeWidth={3} opacity={show} />;
        }))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div data-support="" style={{ ...numberStyle(theme, 62), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={name} /></div>
        <div style={{ ...labelStyle(theme, 30), whiteSpace: "nowrap" }}>En çok kullanılan</div>
        <div style={{ ...labelStyle(theme, 30), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={String(played)} /> maç</div>
      </div>
    </Panel>
  );
}

export function TeamScene({ script, scene }: { script: ReelScript; scene: Extract<ReelScene, { type: "C04_TEAM_HOME" | "C05_TEAM_AWAY" }> }) {
  const theme = themeOf(script);
  const { data } = scene;
  const team = script.meta.teams[data.side];
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 12;
  // 5 değer iki satır: 3 + 2. Görünürlük denetimi her kutuyu ayrı ölçer.
  const rows = [data.stats.slice(0, 3), data.stats.slice(3)].filter((items) => items.length);
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((items, rowIndex) => (
            <div key={rowIndex} style={{ display: "flex", gap: 8 }}>
              {items.map((stat, index) => <StatCell key={stat.key} theme={theme} value={stat.value} label={stat.label} color={team.colors.primary} index={rowIndex * 3 + index} />)}
            </div>
          ))}
        </div>
        <FormationBoard theme={theme} name={data.formation.name} played={data.formation.played} color={team.colors.primary} />
        <Panel theme={theme} name="güçlü zayıf" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 18px" }}>
          {data.points.map((point) => (
            <div key={point.reason.id} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ ...labelStyle(theme, 30), color: point.label === "Güçlü" ? theme.accentText : "#F0A9A9", fontWeight: 800 }}>{point.label}</span>
              <span style={{ ...labelStyle(theme, 36), color: theme.ink }}>{point.reason.text}</span>
            </div>
          ))}
        </Panel>
      </div>
    </AbsoluteFill>
  );
}

function StatCell({ theme, value, label, color, index }: { theme: Theme; value: string; label: string; color: string; index: number }) {
  const enter = useEnter(14 + index * 5, 14);
  return (
    <div data-block={`değer ${label}`} style={{ flex: 1, minWidth: 0, background: theme.panel, borderTop: `6px solid ${color}`, padding: "8px 10px", borderRadius: theme.id === "E" ? 14 : 0, ...enter }}>
      <div data-support="" style={{ ...numberStyle(theme, Math.min(theme.supportSize + 12, 84)), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={value} /></div>
      <div style={{ ...labelStyle(theme, 28), whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

/** Dakika ısı şeridi: 15'lik dilimler, iki takımın attığı ve yediği. Rakam hücrede; renk yalnız yönlendirir. */
export function MinutesScene({ script, scene }: SceneProps<"C06_MINUTES">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 12;
  const highest = Math.max(1, ...data.rows.flatMap((row) => row.cells));
  const cell = Math.floor((W - 40) / 6);
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
        <Panel theme={theme} name="ısı şeridi" style={{ padding: "10px 20px" }}>
          <div style={{ display: "flex" }}>
            {data.slots.map((slot) => <div key={slot} style={{ width: cell, textAlign: "center", ...labelStyle(theme, 26), whiteSpace: "nowrap", color: theme.ink }}><Figures theme={theme} text={slot} /></div>)}
          </div>
          {data.rows.map((row, rowIndex) => {
            const team = script.meta.teams[row.side];
            return (
              <div key={rowIndex} style={{ marginTop: rowIndex === 2 ? 14 : 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <Img src={staticFile(team.logo)} style={{ width: 32, height: 32 }} />
                  <span style={{ ...labelStyle(theme, 28), color: theme.ink, whiteSpace: "nowrap" }}>{team.shortName} · {row.label}</span>
                </div>
                <div style={{ display: "flex" }}>
                  {row.cells.map((value, index) => {
                    const fill = interpolate(frame, [18 + rowIndex * 6 + index * 3, 30 + rowIndex * 6 + index * 3], [0, 1], clamp);
                    const heat = (value / highest) * fill;
                    return (
                      <div key={index} style={{ width: cell, height: 64, padding: 2 }}>
                        <div style={{ width: "100%", height: "100%", background: `rgba(46,165,55,${0.08 + heat * 0.42})`, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: theme.id === "E" ? 12 : 0 }}>
                          <span style={{ ...numberStyle(theme, 44), color: "#FFFFFF" }}><Figures theme={theme} text={String(value)} /></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Panel>
        <ReasonList theme={theme} items={data.reasons} start={70} size={34} />
      </div>
    </AbsoluteFill>
  );
}
