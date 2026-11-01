import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, Crest, Cutout, FONT_FAMILY, Headline, SafeArea } from "../components/Primitives";
import { DotGrid } from "../components/DotGrid";
import { countUp, formatInt, SAFE, WIDTH } from "../lib/motion";
import type { ReelPhoto, ReelScene, ReelScript } from "../schema";

type SceneOf<T extends ReelScene["type"]> = Extract<ReelScene, { type: T }>;

interface Common {
  script: ReelScript;
  accent: string;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CONTENT_WIDTH = WIDTH - SAFE.left - SAFE.right;
const tabular = { fontVariantNumeric: "tabular-nums" } as const;
const DRAW_COLOR = "#8E9A94";

/** Başlık ile alt yazı arasındaki alanın ortası. */
function Middle({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 70 }}>{children}</div>;
}

function photoOf(script: ReelScript, ids: readonly string[], side: "home" | "away"): ReelPhoto | null {
  for (const id of ids) {
    const photo = script.photos[id];
    if (photo?.side === side) return photo;
  }
  return null;
}

/** K0: ilk kare tam dolu ve hareketsizdir; son karenin döndüğü görüntü budur (loop). */
export function CoverScene({ script, scene }: Common & { scene: SceneOf<"K0_COVER"> }) {
  const { home, away } = script.meta.teams;
  const homePhoto = photoOf(script, scene.assets.photoIds, "home");
  const awayPhoto = photoOf(script, scene.assets.photoIds, "away");
  const frame = { width: 620, height: 830 };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(105deg, ${home.colors.primary}55 0%, transparent 50%, ${away.colors.primary}55 100%)` }} />
      {homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} frame={frame} left={-50} bottom={SAFE.bottom} /> : null}
      {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} frame={frame} left={400} bottom={SAFE.bottom} flip /> : null}
      <SafeArea style={{ alignItems: "center" }}>
        <div style={{ marginTop: 92, padding: "10px 28px", borderRadius: 999, background: script.brand.accent, color: "#04120A", fontSize: 40, fontWeight: 900 }}>{scene.data.seriesLabel}</div>
        <div style={{ marginTop: 22, color: "#FFFFFF", fontSize: 40, fontWeight: 700 }}>{script.meta.league.name}</div>
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 46 }}>
          <Crest src={home.logo} size={170} />
          <div style={{ color: "#FFFFFF", fontSize: 54, fontWeight: 900 }}>–</div>
          <Crest src={away.logo} size={170} />
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
}

export function LogoScene({ script }: Common) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Img src={staticFile(script.brand.logo)} style={{ width: 760, transform: `scale(${0.82 + 0.18 * pop})`, opacity: interpolate(frame, [0, 6], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
}

export function HookScene({ script, scene, accent }: Common & { scene: SceneOf<"M1_HOOK"> }) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const shown = countUp(frame, { to: scene.data.simulations, start: 20, duration: 110 });
  const homePhoto = photoOf(script, scene.assets.photoIds, "home");
  const awayPhoto = photoOf(script, scene.assets.photoIds, "away");
  // Yüzün üstüne yazı binmez: sayaç yukarıda, oyuncular ızgaranın altında.
  const cut = { width: 400, height: 330 };
  return (
    <AbsoluteFill>
      {homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} frame={cut} left={40} bottom={SAFE.bottom + 44} drift={12} /> : null}
      {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} frame={cut} left={510} bottom={SAFE.bottom + 44} drift={-12} flip /> : null}
      <SafeArea>
        <Headline line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <div style={{ marginTop: 24, display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ color: "#FFFFFF", fontSize: 112, fontWeight: 900, letterSpacing: -3, lineHeight: 1, ...tabular }}>{formatInt(shown)}</div>
          <div style={{ color: "#FFFFFF", fontSize: 38, fontWeight: 500 }}>simülasyon</div>
        </div>
        <div style={{ marginTop: 24 }}>
          <DotGrid size={CONTENT_WIDTH} rows={20} columns={50} segments={[{ color: `${accent}D9`, lit: Math.floor((shown / scene.data.simulations) * 1000) }]} />
        </div>
        {scene.caption ? <Caption text={scene.caption} /> : null}
      </SafeArea>
    </AbsoluteFill>
  );
}

export function WinnerScene({ script, scene, accent }: Common & { scene: SceneOf<"M3_WINNER"> }) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  // Sırayla boyanır: ev, beraberlik, deplasman. Her yüzde kendi bloğu dolarken sayılır.
  const fill = (to: number, start: number) => countUp(frame, { to, start, duration: 40 });
  const stops = { home: 30, draw: 84, away: 138 };
  const stats = [
    { key: "home", label: home.name, crest: home.logo, value: fill(data.home, stops.home), color: home.colors.primary, start: stops.home },
    { key: "draw", label: "Beraberlik", crest: null, value: fill(data.draw, stops.draw), color: DRAW_COLOR, start: stops.draw },
    { key: "away", label: away.name, crest: away.logo, value: fill(data.away, stops.away), color: away.colors.primary, start: stops.away },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, width: "50%", background: `linear-gradient(90deg, ${home.colors.primary}3D, ${home.colors.primary}12)` }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%", background: `linear-gradient(270deg, ${away.colors.primary}3D, ${away.colors.primary}12)` }} />
      <SafeArea>
        <Headline line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <div style={{ marginTop: 40 }}>
          <DotGrid
            size={CONTENT_WIDTH}
            fill="blocks"
            segments={[
              { color: home.colors.primary, lit: fill(data.dots.home, stops.home) },
              { color: DRAW_COLOR, lit: fill(data.dots.draw, stops.draw) },
              { color: away.colors.primary, lit: fill(data.dots.away, stops.away) },
            ]}
          />
        </div>
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {stats.map((stat) => (
            <div key={stat.key} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: interpolate(frame, [stat.start - 4, stat.start + 6], [0, 1], clamp) }}>
              <div style={{ color: stat.color, fontSize: 92, fontWeight: 900, letterSpacing: -2, lineHeight: 1, ...tabular }}>%{stat.value}</div>
              <div style={{ color: "#FFFFFF", fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{stat.label}</div>
            </div>
          ))}
        </div>
        {scene.caption ? <Caption text={scene.caption} /> : null}
      </SafeArea>
    </AbsoluteFill>
  );
}

export function GoalsScene({ scene, accent }: Common & { scene: SceneOf<"M4_GOALS"> }) {
  const frame = useCurrentFrame();
  const shown = countUp(frame, { to: scene.data.percent, start: 24, duration: 70 });
  const radius = 360;
  const path = `M ${60} ${radius + 60} A ${radius} ${radius} 0 0 1 ${radius * 2 + 60} ${radius + 60}`;
  return (
    <AbsoluteFill>
      <SafeArea>
        <Headline line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <Middle><div style={{ position: "relative", alignSelf: "center" }}>
          <svg width={radius * 2 + 120} height={radius + 110} viewBox={`0 0 ${radius * 2 + 120} ${radius + 110}`} style={{ display: "block" }}>
            <path d={path} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={56} strokeLinecap="round" />
            <path d={path} fill="none" stroke={accent} strokeWidth={56} strokeLinecap="round" pathLength={100} strokeDasharray={`${shown} 100`} />
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center", color: "#FFFFFF", fontSize: 168, fontWeight: 900, letterSpacing: -4, lineHeight: 1, ...tabular }}>%{shown}</div>
        </div>
        <div style={{ marginTop: 24, textAlign: "center", color: "#FFFFFF", fontSize: 44, fontWeight: 700 }}>{scene.data.label}</div></Middle>
        {scene.caption ? <Caption text={scene.caption} /> : null}
      </SafeArea>
    </AbsoluteFill>
  );
}

export function FirstGoalScene({ script, scene, accent }: Common & { scene: SceneOf<"M6_FIRST_GOAL"> }) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const homeLeads = data.home >= data.away;
  const leader = homeLeads ? home : away;
  const draw = interpolate(frame, [30, 80], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const width = 560;
  const height = 640;
  // Ev sahibi yukarı, deplasman aşağı hücum eder.
  const targetY = homeLeads ? 40 : height - 40;
  const pitchLine = { stroke: "rgba(255,255,255,0.32)", strokeWidth: 4, fill: "none" };
  return (
    <AbsoluteFill>
      <SafeArea>
        <Headline line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <Middle><div style={{ display: "flex", gap: 30, alignItems: "stretch" }}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }}>
            <rect x={4} y={4} width={width - 8} height={height - 8} rx={14} {...pitchLine} />
            <line x1={4} y1={height / 2} x2={width - 4} y2={height / 2} {...pitchLine} />
            <circle cx={width / 2} cy={height / 2} r={72} {...pitchLine} />
            <rect x={width / 2 - 130} y={4} width={260} height={92} {...pitchLine} />
            <rect x={width / 2 - 130} y={height - 96} width={260} height={92} {...pitchLine} />
            <line x1={width / 2} y1={height / 2} x2={width / 2} y2={targetY} stroke={leader.colors.primary} strokeWidth={14} strokeLinecap="round" pathLength={100} strokeDasharray={`${draw * 100} 100`} />
            <circle cx={width / 2} cy={height / 2} r={14} fill="#FFFFFF" />
            <circle cx={width / 2} cy={targetY} r={22} fill={leader.colors.primary} opacity={draw >= 1 ? 1 : 0} />
          </svg>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingBlock: 6 }}>
            {[
              { team: home, value: data.home },
              { team: away, value: data.away },
            ].map(({ team, value }) => (
              <div key={team.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Crest src={team.logo} size={92} />
                <div style={{ color: team.colors.primary, fontSize: 88, fontWeight: 900, letterSpacing: -2, lineHeight: 1, ...tabular }}>%{countUp(frame, { to: value, start: 40, duration: 50 })}</div>
                <div style={{ color: "#FFFFFF", fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>{team.name}</div>
              </div>
            ))}
          </div>
        </div></Middle>
        {scene.caption ? <Caption text={scene.caption} /> : null}
      </SafeArea>
    </AbsoluteFill>
  );
}

export function ChanceNoteScene({ scene, accent }: Common & { scene: SceneOf<"K9_CHANCE_NOTE"> }) {
  const frame = useCurrentFrame();
  const { data } = scene;
  const size = 148;
  return (
    <AbsoluteFill>
      <SafeArea>
        <Headline line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <Middle><div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 22, justifyItems: "center" }}>
          {Array.from({ length: 10 }, (_, index) => {
            const start = 30 + index * 6;
            const filled = index < data.hitsOfTen;
            const pop = interpolate(frame, [start, start + 8], [0, 1], clamp);
            return (
              <div key={index} style={{ width: size, height: size, borderRadius: "50%", border: `6px solid ${filled ? accent : "rgba(255,255,255,0.28)"}`, background: filled ? accent : "transparent", opacity: pop, transform: `scale(${0.7 + 0.3 * pop})` }} />
            );
          })}
        </div>
        <div style={{ marginTop: 66, color: "#FFFFFF", fontSize: 50, fontWeight: 700, lineHeight: 1.2, opacity: interpolate(frame, [90, 102], [0, 1], clamp) }}>{data.statement}</div></Middle>
        {scene.caption ? <Caption text={scene.caption} /> : null}
      </SafeArea>
    </AbsoluteFill>
  );
}

export function PromptScene({ script, scene, accent }: Common & { scene: SceneOf<"K11_PROMPT"> }) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const pulse = 1 + 0.025 * Math.sin((frame / 30) * Math.PI * 1.2);
  return (
    <AbsoluteFill>
      <SafeArea>
        <Headline line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <Middle><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Crest src={home.logo} size={210} />
          <div style={{ color: "#FFFFFF", fontSize: 130, fontWeight: 900, ...tabular, transform: `scale(${pulse})` }}>? – ?</div>
          <Crest src={away.logo} size={210} />
        </div>
        <div style={{ marginTop: 110, textAlign: "center", color: accent, fontSize: 72, fontWeight: 900, opacity: interpolate(frame, [30, 42], [0, 1], clamp) }}>{scene.data.prompt}</div></Middle>
      </SafeArea>
    </AbsoluteFill>
  );
}

/** K12: son karede K0'ın birebir aynısı görünür, video başına kesintisiz döner. */
export function CloseScene({ script, scene, accent }: Common & { scene: SceneOf<"K12_CLOSE"> }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const cover = script.scenes.find((item): item is SceneOf<"K0_COVER"> => item.type === "K0_COVER");
  const fadeFrom = durationInFrames - 12;
  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34, opacity: interpolate(frame, [fadeFrom, durationInFrames - 2], [1, 0], clamp) }}>
        <Img src={staticFile(script.brand.logo)} style={{ width: 720 }} />
        <div style={{ color: accent, fontSize: 58, fontWeight: 700 }}>{scene.data.handle}</div>
      </AbsoluteFill>
      {cover ? (
        <AbsoluteFill style={{ opacity: interpolate(frame, [fadeFrom, durationInFrames - 1], [0, 1], clamp) }}>
          <CoverScene script={script} accent={accent} scene={cover} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
