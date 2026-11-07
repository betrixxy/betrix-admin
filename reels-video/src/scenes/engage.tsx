import { AbsoluteFill, Freeze, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Panel, themeOf, useEnter } from "../design/kit";
import { BOTTOM, HUD_TOP, labelStyle, type Theme, W, X } from "../design/tokens";
import type { SceneProps } from "./common";
import { StageCover } from "./players";
import { SceneBackdrop } from "../components/SceneBackdrop";

/** Son 12 kare kapağa erir: video başa akıcı döner. Denetim karesi bunun öncesindedir. */
export const LOOP_FRAMES = 12;

type Call = SceneProps<"S18_ENGAGE">["scene"]["data"]["calls"][number];
const LABEL: Record<Call, string> = { like: "Beğen", comment: "Yorum yap", share: "Paylaş", save: "Kaydet" };

/** Vektör ikonlar: emoji değil, tek çizgi kalınlığı. */
function CallIcon({ call, color }: { call: Call; color: string }) {
  const stroke = { fill: "none", stroke: color, strokeWidth: 7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg data-fill="" width={108} height={108} viewBox="0 0 100 100" style={{ display: "block" }}>
      {call === "like" ? <path {...stroke} d="M50 86 C20 64 10 48 10 33 C10 20 20 12 31 12 C39 12 46 16 50 24 C54 16 61 12 69 12 C80 12 90 20 90 33 C90 48 80 64 50 86 Z" /> : null}
      {call === "comment" ? <path {...stroke} d="M14 20 H86 V68 H44 L24 86 V68 H14 Z" /> : null}
      {call === "share" ? <path {...stroke} d="M88 14 L12 44 L42 56 L54 86 Z M42 56 L88 14" /> : null}
      {call === "save" ? <path {...stroke} d="M24 12 H76 V88 L50 68 L24 88 Z" /> : null}
    </svg>
  );
}

function CallCell({ theme, call, index }: { theme: Theme; call: Call; index: number }) {
  const enter = useEnter(6 + index * 5, 12);
  return (
    <div data-block={`çağrı ${LABEL[call]}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 4px", background: theme.panel, ...enter }}>
      <CallIcon call={call} color={theme.accentText} />
      <div style={{ ...labelStyle(theme, 40), color: theme.ink, whiteSpace: "nowrap" }}>{LABEL[call]}</div>
    </div>
  );
}

export function EngageScene({ script, scene }: SceneProps<"S18_ENGAGE">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const cover = script.scenes[0]?.type === "S01_COVER" ? script.scenes[0] : null;
  const loopStart = scene.durationInFrames - LOOP_FRAMES;
  const back = interpolate(frame, [loopStart, scene.durationInFrames - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: X, width: W, top: HUD_TOP + 60, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", gap: 14, opacity: 1 - back }}>
        <div data-block="logo" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "34px 0", flex: 1 }}>
          <Img src={staticFile(script.brand.logo)} style={{ width: 660, height: "auto" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {data.calls.map((call, index) => <CallCell key={call} theme={theme} call={call} index={index} />)}
        </div>
        <Panel theme={theme} name="etiketle" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "16px 20px" }}>
          <div style={{ ...labelStyle(theme, 58), color: theme.ink, lineHeight: 1.1 }}>{data.prompt}</div>
        </Panel>
        <Panel theme={theme} name="daha fazla" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 20px" }}>
          <div style={{ ...labelStyle(theme, 44), color: theme.ink, whiteSpace: "nowrap" }}>{data.more}</div>
          <div style={{ ...labelStyle(theme, 44), color: theme.accentText, fontWeight: 800, whiteSpace: "nowrap" }}>{data.handle}</div>
        </Panel>
      </div>
      {back > 0 && cover ? <AbsoluteFill style={{ opacity: back }}><SceneBackdrop script={script} type="S01_COVER" /><Freeze frame={0}><StageCover script={script} scene={cover} /></Freeze></AbsoluteFill> : null}
    </AbsoluteFill>
  );
}
