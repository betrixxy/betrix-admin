import { AbsoluteFill, Img, staticFile } from "remotion";
import { Figures, Panel, QuestionTitle, themeOf, titleBottom, useEnter } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import type { ReelScene, ReelScript } from "../schema";
import type { SceneProps } from "./common";
import { ReasonList } from "./reason-list";

/** Futbol okumasının ilk üç kartı: maçın hikâyesi, form ve seriler, eksikler. */

const Area = ({ top, children }: { top: number; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>{children}</div>
);
const titled = (theme: Theme, scene: Pick<ReelScene, "headline">) => {
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  return { line1, line2, top: titleBottom(theme, line1, line2) + 12 };
};

function TableCard({ script, side, row, index }: { script: ReelScript; side: "home" | "away"; row: { rank: number; points: number; played: number; goalsDiff: number }; index: number }) {
  const theme = themeOf(script);
  const team = script.meta.teams[side];
  const enter = useEnter(16 + index * 8);
  return (
    <div data-block={`tablo ${team.shortName}`} style={{ flex: 1, minWidth: 0, background: theme.panel, padding: "14px 16px", borderTop: `8px solid ${team.colors.primary}`, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 6, borderRadius: theme.id === "E" ? 18 : 0, ...enter }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Img src={staticFile(team.logo)} style={{ width: 52, height: 52 }} />
        <span style={{ ...labelStyle(theme, 36), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.titleUpper ? "uppercase" : "none" }}>{team.shortName}</span>
      </div>
      <div data-hero="" style={{ ...numberStyle(theme, 190), color: theme.ink }}><Figures theme={theme} text={`${row.rank}.`} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column" }}><span data-support="" style={{ ...numberStyle(theme, 60), color: theme.ink }}><Figures theme={theme} text={String(row.points)} /></span><span style={labelStyle(theme, 36)}>puan</span></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}><span data-support="" style={{ ...numberStyle(theme, 60), color: theme.ink }}><Figures theme={theme} text={row.goalsDiff > 0 ? `+${row.goalsDiff}` : String(row.goalsDiff)} /></span><span style={labelStyle(theme, 36)}>averaj</span></div>
      </div>
    </div>
  );
}

export function StoryScene({ script, scene }: SceneProps<"C01_STORY">) {
  const theme = themeOf(script);
  const { line1, line2, top } = titled(theme, scene);
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={top}>
        <div style={{ display: "flex", gap: 12, flex: 2 }}>
          <TableCard script={script} side="home" row={scene.data.home} index={0} />
          <TableCard script={script} side="away" row={scene.data.away} index={1} />
        </div>
        <ReasonList theme={theme} items={scene.data.reasons} start={44} size={52} />
      </Area>
    </AbsoluteFill>
  );
}

const LETTER_COLOR = { G: "#2EA537", B: "#5F6866", M: "#C8323C" } as const;

function FormBlock({ script, side, index }: { script: ReelScript; side: { key: "home" | "away"; data: SceneProps<"C02_FORM">["scene"]["data"]["home"] }; index: number }) {
  const theme = themeOf(script);
  const team = script.meta.teams[side.key];
  const enter = useEnter(16 + index * 10);
  const { venue, streaks, last5, venueLabel } = side.data;
  return (
    <Panel theme={theme} name={`form ${team.shortName}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 10, padding: "14px 18px", ...enter }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Img src={staticFile(team.logo)} style={{ width: 50, height: 50 }} />
          <span style={{ ...labelStyle(theme, 38), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.titleUpper ? "uppercase" : "none" }}>{team.shortName}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {last5.map((letter, position) => <span key={position} style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", background: LETTER_COLOR[letter], color: letter === "G" ? theme.accentInk : "#FFFFFF", fontFamily: theme.label, fontWeight: 800, fontSize: 38, borderRadius: theme.id === "E" ? 25 : 0 }}>{letter}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span data-support="" style={{ ...numberStyle(theme, 56), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={`${venue.win}–${venue.draw}–${venue.lose}`} /></span>
          <span style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>{venueLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span data-support="" style={{ ...numberStyle(theme, 58), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={`${venue.goalsFor}–${venue.goalsAgainst}`} /></span>
          <span style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>Gol</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span data-support="" style={{ ...numberStyle(theme, 58), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={String(streaks.wins)} /></span>
          <span style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>En uzun seri</span>
        </div>
      </div>
    </Panel>
  );
}

export function FormScene({ script, scene }: SceneProps<"C02_FORM">) {
  const theme = themeOf(script);
  const { line1, line2, top } = titled(theme, scene);
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={top}>
        <FormBlock script={script} side={{ key: "home", data: scene.data.home }} index={0} />
        <FormBlock script={script} side={{ key: "away", data: scene.data.away }} index={1} />
        <ReasonList theme={theme} items={scene.data.reasons} start={50} size={44} grow={false} />
      </Area>
    </AbsoluteFill>
  );
}

const STATUS = { injured: { label: "Sakat", color: "#C8323C", ink: "#FFFFFF" }, suspended: { label: "Cezalı", color: "#E6B422", ink: "#1A1400" }, doubtful: { label: "Şüpheli", color: "#D9DEDA", ink: "#141714" } } as const;
type AbsenceRow = SceneProps<"C03_ABSENCES">["scene"]["data"]["home"][number];

function AbsenceLine({ theme, row, index }: { theme: Theme; row: AbsenceRow; index: number }) {
  const enter = useEnter(22 + index * 7, 14);
  const status = STATUS[row.status];
  const involvement = row.goals !== null && row.assists !== null ? `${row.goals}+${row.assists}` : null;
  return (
    <div data-block={`eksik ${row.name}`} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderTop: `2px solid ${theme.panelEdge}`, ...enter }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ ...labelStyle(theme, 46), color: theme.ink, whiteSpace: "nowrap" }}>{row.name}</span>
        <span style={{ fontFamily: theme.label, fontWeight: theme.labelWeight, fontSize: 36, lineHeight: 1, color: status.ink, background: status.color, padding: "6px 12px", whiteSpace: "nowrap", borderRadius: theme.id === "E" ? 16 : 0 }}>{status.label}</span>
      </div>
      <div data-label="" style={{ display: "flex", gap: 20, ...labelStyle(theme, 36), whiteSpace: "nowrap" }}>
        {row.minutes ? <span><Figures theme={theme} text={row.minutes} /> dk</span> : null}
        {involvement ? <span><Figures theme={theme} text={involvement} /> G+A</span> : null}
        {row.share ? <span style={{ color: theme.ink }}>Pay <Figures theme={theme} text={row.share} /></span> : null}
      </div>
    </div>
  );
}

function TeamAbsences({ script, side, rows }: { script: ReelScript; side: "home" | "away"; rows: readonly AbsenceRow[] }) {
  const theme = themeOf(script);
  const team = script.meta.teams[side];
  return (
    <Panel theme={theme} name={`eksikler ${team.shortName}`} style={{ flex: Math.max(rows.length, 1) + 1, padding: "12px 18px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8 }}>
        <Img src={staticFile(team.logo)} style={{ width: 46, height: 46 }} />
        <span style={{ ...labelStyle(theme, 36), color: theme.ink, textTransform: theme.titleUpper ? "uppercase" : "none", whiteSpace: "nowrap" }}>{team.shortName}</span>
      </div>
      {rows.length ? rows.map((row, index) => <AbsenceLine key={row.name} theme={theme} row={row} index={index} />) : <div style={{ ...labelStyle(theme, 40), padding: "6px 0" }}>Bildirilen eksik yok</div>}
    </Panel>
  );
}

/** En büyük eksiğin payı ekranın ana rakamıdır. */
function BiggestAbsence({ theme, share, text }: { theme: Theme; share: string | null; text: string | null }) {
  const enter = useEnter(54, 14);
  if (!share || !text) return null;
  return (
    <Panel theme={theme} name="en büyük eksik" style={{ display: "flex", alignItems: "center", gap: 18, padding: "10px 18px", ...enter }}>
      <div data-hero="" style={{ ...numberStyle(theme, 160), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={share} /></div>
      <div data-bullet="" style={{ ...labelStyle(theme, 42), color: theme.ink, lineHeight: 1.12 }}>{text}</div>
    </Panel>
  );
}

export function AbsencesScene({ script, scene }: SceneProps<"C03_ABSENCES">) {
  const theme = themeOf(script);
  const { line1, line2, top } = titled(theme, scene);
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={top}>
        <TeamAbsences script={script} side="home" rows={scene.data.home} />
        <TeamAbsences script={script} side="away" rows={scene.data.away} />
        <BiggestAbsence theme={theme} share={[...scene.data.home, ...scene.data.away].flatMap((row) => (row.share ? [row.share] : [])).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0] ?? null} text={scene.data.reasons[0]?.text ?? null} />
      </Area>
    </AbsoluteFill>
  );
}
