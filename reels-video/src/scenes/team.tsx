import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BoardPanel, ChalkArrow, HandLabel, Magnet, boardLabel } from "../design/board";
import { Figures, Panel, QuestionTitle, themeOf, titleBottom, useEnter } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import type { ReelScene, ReelScript } from "../schema";
import type { SceneProps } from "./common";
import { LineupBoard } from "./lineup-board";
import { ReasonList } from "./reason-list";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Diziliş tahtası: "4-2-3-1" satırları mıknatıs pul olur, kaleci dahil. Veride yalnız diziliş adı var, oyuncu adı yazılmaz. */
function FormationBoard({ theme, name, played, color }: { theme: Theme; name: string; played: number; color: string }) {
  const frame = useCurrentFrame();
  const lines = name.split("-").map((part) => Number.parseInt(part, 10)).filter((count) => Number.isFinite(count) && count > 0);
  const height = 470;
  const band = 104;
  const pitch = height - band;
  const columns = lines.length + 1;
  const xOf = (column: number) => 60 + (column * (W - 130)) / Math.max(columns, 1);
  return (
    <BoardPanel name="diziliş" width={W} height={height}>
      <HandLabel theme={theme} text="En sık diziliş" size={60} style={{ left: 22, top: 18 }} />
      <div style={{ position: "absolute", right: 20, top: 14, display: "flex", alignItems: "baseline", gap: 14 }}>
        <span data-support="" style={{ ...numberStyle(theme, 66), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={name} /></span>
        <span style={{ ...boardLabel(theme, 40) }}><Figures theme={theme} text={String(played)} /> maç</span>
      </div>
      <svg data-fill="" width={W} height={pitch} viewBox={`0 0 ${W} ${pitch}`} style={{ position: "absolute", left: 0, top: band }}>
        <Magnet x={xOf(0)} y={pitch / 2} r={26} color="#F4F6EF" show={interpolate(frame, [14, 22], [0, 1], clamp)} />
        {lines.flatMap((count, lineIndex) => Array.from({ length: count }, (_, index) => (
          <Magnet key={`${lineIndex}-${index}`} x={xOf(lineIndex + 1)} y={((index + 1) * pitch) / (count + 1)} r={30} color={color} show={interpolate(frame, [20 + lineIndex * 6, 30 + lineIndex * 6], [0, 1], clamp)} />
        )))}
      </svg>
    </BoardPanel>
  );
}

export function TeamScene({ script, scene }: { script: ReelScript; scene: Extract<ReelScene, { type: "C04_TEAM_HOME" | "C05_TEAM_AWAY" }> }) {
  const theme = themeOf(script);
  const { data } = scene;
  const team = script.meta.teams[data.side];
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 12;
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          {data.stats.slice(0, 3).map((stat, index) => <StatCell key={stat.key} theme={theme} value={stat.value} label={stat.label} color={team.colors.primary} index={index} />)}
        </div>
        {data.lineup ? <LineupBoard theme={theme} lineup={data.lineup} board={data.board} color={team.colors.primary} /> : data.formation ? <FormationBoard theme={theme} name={data.formation.name} played={data.formation.played} color={team.colors.primary} /> : null}
        <ReasonList theme={theme} items={data.points.map((point) => point.reason)} start={44} size={42} />
      </div>
    </AbsoluteFill>
  );
}

function StatCell({ theme, value, label, color, index }: { theme: Theme; value: string; label: string; color: string; index: number }) {
  const enter = useEnter(14 + index * 5, 14);
  return (
    <div data-block={`değer ${label}`} style={{ flex: 1, minWidth: 0, background: theme.panel, borderTop: `8px solid ${color}`, padding: "10px 12px", borderRadius: theme.id === "E" ? 14 : 0, ...enter }}>
      <div data-support="" style={{ ...numberStyle(theme, 72), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={value} /></div>
      <div style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

const SLOT_ROW = 44;
const ROW_LABEL = 44;
const CELL = 82;
const BAND = 70;

/** Dakika tahtası: 15'lik dilimler, iki takımın attığı ve yediği. En yüksek dilim tebeşirle işaretli; rakam hücrede, renk yalnız yönlendirir. */
export function MinutesScene({ script, scene }: SceneProps<"C06_MINUTES">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 12;
  const highest = Math.max(1, ...data.rows.flatMap((row) => row.cells));
  const cell = Math.floor((W - 40) / 6);
  const firstRow = data.rows[0]?.cells ?? [];
  const peak = firstRow.reduce((best, value, index) => (value > (firstRow[best] ?? 0) ? index : best), 0);
  const height = BAND + SLOT_ROW + data.rows.length * (ROW_LABEL + CELL + 6) + 12;
  const peakX = 20 + peak * cell + cell / 2;
  // Kritik bölge: her satırın en yüksek dilimi halkalı; yediği satırında kırmızı.
  const peakOf = (cells: readonly number[]) => cells.reduce((best, value, index) => (value > (cells[best] ?? 0) ? index : best), 0);
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <BoardPanel name="dakika tahtası" width={W} height={height} lines={false}>
          <HandLabel theme={theme} text="Buraya bak" size={58} style={{ left: peak >= 3 ? 40 : W - 300, top: 8 }} />
          <div style={{ position: "absolute", left: 20, top: BAND, display: "flex" }}>
            {data.slots.map((slot) => <div key={slot} style={{ width: cell, textAlign: "center", ...boardLabel(theme, 34) }}>{slot}</div>)}
          </div>
          <div style={{ position: "absolute", left: 20, top: BAND + SLOT_ROW }}>
            {data.rows.map((row, rowIndex) => {
              const team = script.meta.teams[row.side];
              return (
                <div key={rowIndex} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, height: ROW_LABEL }}>
                    <Img src={staticFile(team.logo)} style={{ width: 36, height: 36 }} />
                    <span style={boardLabel(theme, 34)}>{team.shortName} · {row.label}</span>
                  </div>
                  <div style={{ display: "flex" }}>
                    {row.cells.map((value, index) => {
                      const fill = interpolate(frame, [18 + rowIndex * 6 + index * 3, 30 + rowIndex * 6 + index * 3], [0, 1], clamp);
                      const heat = (value / highest) * fill;
                      return (
                        <div key={index} style={{ width: cell, height: CELL, padding: 2 }}>
                          <div style={{ width: "100%", height: "100%", background: `rgba(46,165,55,${0.08 + heat * 0.42})`, boxShadow: index === peakOf(row.cells) ? `inset 0 0 0 5px ${row.label === "Yediği" ? "#FF6B72" : theme.accentText}` : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ ...numberStyle(theme, 56), color: "#FFFFFF" }}><Figures theme={theme} text={String(value)} /></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <ChalkArrow width={W} height={height} from={peak >= 3 ? [300, 40] : [W - 310, 40]} to={[peakX, BAND - 18]} bend={-10} color={theme.accentText} start={60} name="dakika" />
        </BoardPanel>
        <ReasonList theme={theme} items={data.reasons} start={70} size={42} />
      </div>
    </AbsoluteFill>
  );
}
