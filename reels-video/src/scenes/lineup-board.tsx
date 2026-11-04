import { useCurrentFrame, interpolate } from "remotion";
import { BOARD_GROUND, BoardPanel, ChalkArrow, HandLabel, boardLabel, inkOn } from "../design/board";
import { Figures } from "../design/kit";
import { numberStyle, type Theme, W } from "../design/tokens";
import type { ReelScene } from "../schema";

type TeamData = Extract<ReelScene, { type: "C04_TEAM_HOME" | "C05_TEAM_AWAY" }>["data"];
type Lineup = NonNullable<TeamData["lineup"]>;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const HEADER = 64;
const PITCH = 490;
const STRIP = 62;
const SOURCE = 50;
export const LINEUP_BOARD_HEIGHT = HEADER + PITCH + STRIP + SOURCE;
const PUCK = 62;
const NAME = 36;
const ZONE = 150;
const TINT = { strong: "rgba(46,165,55,0.3)", weak: "rgba(200,50,60,0.32)" } as const;

function Puck({ theme, slot, lineCount, color }: { theme: Theme; slot: Lineup["slots"][number]; lineCount: number; color: string }) {
  const frame = useCurrentFrame();
  const span = W - 172;
  const x = 86 + (slot.line * span) / Math.max(lineCount - 1, 1);
  const y = HEADER + (PITCH * (slot.index + 0.5)) / slot.lineSize;
  const show = interpolate(frame, [12 + slot.line * 5, 20 + slot.line * 5], [0, 1], clamp);
  const empty = slot.name === null;
  return (
    <div style={{ position: "absolute", left: x - 100, width: 200, top: y - (PUCK + NAME) / 2, display: "flex", flexDirection: "column", alignItems: "center", opacity: show }}>
      <div style={{ ...numberStyle(theme, 34), width: PUCK, height: PUCK, flexShrink: 0, borderRadius: PUCK / 2, display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", color: empty ? "#F4F6EF" : inkOn(color), background: empty ? BOARD_GROUND : color, border: empty ? "4px dashed #F4F6EF" : "3px solid #F4F6EF", boxShadow: "3px 5px 0 rgba(0,0,0,0.4)" }}>
        {empty ? "?" : slot.number ?? ""}
      </div>
      {empty ? null : <div data-label="" style={{ ...boardLabel(theme, 34), lineHeight: `${NAME}px`, height: NAME, background: BOARD_GROUND, padding: "0 6px" }}>{slot.name}</div>}
    </div>
  );
}

/** Muhtemel 11: mıknatıs pullar, üstte numara, altta kısa ad. Güçlü/zayıf yön veriden: lig ortalamasıyla kıyas. Kesinlik iddiası yok. */
export function LineupBoard({ theme, lineup, board, color }: { theme: Theme; lineup: Lineup; board: TeamData["board"]; color: string }) {
  const lineCount = Math.max(...lineup.slots.map((slot) => slot.line)) + 1;
  const stripY = HEADER + PITCH + STRIP / 2;
  const handSize = 46;
  return (
    <BoardPanel name="muhtemel 11" width={W} height={HEADER + PITCH} style={{ height: LINEUP_BOARD_HEIGHT, flexShrink: 0 }}>
      {board.defence ? <div style={{ position: "absolute", left: 0, top: HEADER, width: ZONE, height: PITCH, background: TINT[board.defence] }} /> : null}
      {board.attack ? <div style={{ position: "absolute", right: 0, top: HEADER, width: ZONE, height: PITCH, background: TINT[board.attack] }} /> : null}
      <div style={{ position: "absolute", left: 20, right: 20, top: 8, height: HEADER - 8, display: "flex", alignItems: "center", justifyContent: "space-between", background: BOARD_GROUND }}>
        <span style={{ ...boardLabel(theme, 46), fontWeight: 800 }}>Muhtemel 11</span>
        <span data-support="" style={{ ...numberStyle(theme, 52), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={lineup.formation} /></span>
      </div>
      {lineup.slots.map((slot) => <Puck key={`${slot.line}-${slot.index}`} theme={theme} slot={slot} lineCount={lineCount} color={color} />)}
      <div style={{ position: "absolute", left: 0, right: 0, top: HEADER + PITCH, height: STRIP + SOURCE, background: BOARD_GROUND }} />
      {board.defence === "strong" ? <HandLabel theme={theme} text="Savunma güçlü" size={handSize} rotate={-2} style={{ left: 20, top: stripY - 26 }} /> : null}
      {board.defence === "weak" ? <HandLabel theme={theme} text="Savunma zayıf" size={handSize} rotate={-2} color="#FF8A8F" style={{ left: 108, top: stripY - 26 }} /> : null}
      {board.defence === "weak" ? <ChalkArrow width={W} height={LINEUP_BOARD_HEIGHT} from={[100, stripY]} to={[20, stripY]} color="#FF8A8F" start={40} name="savunma" /> : null}
      {board.attack === "strong" ? <HandLabel theme={theme} text="Hücum güçlü" size={handSize} rotate={-2} style={{ left: W - 340, top: stripY - 26 }} /> : null}
      {board.attack === "strong" ? <ChalkArrow width={W} height={LINEUP_BOARD_HEIGHT} from={[W - 104, stripY]} to={[W - 24, stripY]} color={theme.accentText} start={40} name="hucum" /> : null}
      {board.attack === "weak" ? <HandLabel theme={theme} text="Hücum zayıf" size={handSize} rotate={-2} color="#FF8A8F" style={{ left: W - 250, top: stripY - 26 }} /> : null}
      <div data-label="" style={{ ...boardLabel(theme, 34), position: "absolute", left: 20, top: HEADER + PITCH + STRIP, height: 40, lineHeight: "40px" }}>{lineup.sourceLabel}</div>
    </BoardPanel>
  );
}
