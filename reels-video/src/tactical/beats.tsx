import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { seeded, splitDots } from "../lib/motion";
import { PITCH, countTo } from "./camera";
import { Dot } from "./Board";
import { CONTENT, GREEN, GREEN_TEXT, INK, PANEL, Percent, SAFE, SAFE_WIDTH, Tag, Title, labelFont, numberFont, upper } from "./parts";
import { BothBoard, BothOverlay, GoalsBoard, GoalsOverlay } from "./beats-goals";
import { CloseOverlay } from "./beats-close";
import { DuelBoard, DuelOverlay, WhyOverlay } from "./beats-story";
import type { Beat, TacticalScript } from "./types";
import { num, text } from "./values";

/**
 * Beat katmanları. `BoardLayer` saha düzleminde (perspektifle) çizilir, `Overlay` ekranda. Rakamlar `beat.values`'tan gelir.
 */


export function Lineups({ script, dim }: { script: TacticalScript; dim: number }) {
  return (
    <>
      {script.home.players.map((player) => <Dot key={`h${player.id}`} player={player} side="home" team={script.home} dim={dim} />)}
      {script.away.players.map((player) => <Dot key={`a${player.id}`} player={player} side="away" team={script.away} dim={dim} />)}
    </>
  );
}

/** Monte Carlo görseli: merkezden kalelere silik top yolları, sayısı sonuç payına göre; yanıp söner. */
function BallPaths({ beat, local }: { beat: Beat; local: number }) {
  const counts = splitDots([num(beat, "home"), num(beat, "draw"), num(beat, "away")], 48);
  const paths = counts.flatMap((count, kind) => Array.from({ length: count }, (_, i) => ({ kind, i })));
  const { width: w, height: h } = PITCH;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {paths.map(({ kind, i }, index) => {
        const r = (k: number) => seeded(index * 7 + k);
        const startX = w * (0.3 + r(1) * 0.4);
        const startY = h * (0.42 + r(2) * 0.16);
        const endX = w * (0.42 + r(3) * 0.16);
        const endY = kind === 0 ? 8 : kind === 2 ? h - 8 : h * (0.3 + r(4) * 0.4);
        const bend = (r(5) - 0.5) * w * 0.7;
        const on = seeded(index * 13 + Math.floor((local + index) / 4)) > 0.55;
        const color = kind === 0 ? "rgba(255,214,90,0.9)" : kind === 2 ? "rgba(90,220,120,0.9)" : "rgba(230,236,232,0.8)";
        return <path key={index} d={`M${startX} ${startY} Q${(startX + endX) / 2 + bend} ${(startY + endY) / 2} ${endX} ${endY}`} stroke={color} strokeWidth={4} fill="none" opacity={on ? 0.55 : 0.1} strokeLinecap="round" />;
      })}
    </svg>
  );
}

/** Saha üç bölgeye: üstte deplasman, ortada beraberlik, altta ev sahibi; yüzdeye göre dolar. */
function OutcomeZones({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const fill = interpolate(local, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const away = num(beat, "away") / 100;
  const draw = num(beat, "draw") / 100;
  const zones = [
    { top: 0, height: away, color: script.away.primary },
    { top: away, height: draw, color: "#9AA3A0" },
    { top: away + draw, height: 1 - away - draw, color: script.home.primary },
  ];
  return (
    <>
      {zones.map((zone, index) => (
        <div key={index} style={{ position: "absolute", left: 0, width: PITCH.width, top: zone.top * PITCH.height, height: zone.height * PITCH.height, background: zone.color, opacity: 0.5 * fill, borderTop: index ? "4px solid rgba(255,255,255,0.7)" : undefined }} />
      ))}
    </>
  );
}

export function BoardLayer({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  switch (beat.kind) {
    case "hook": return <BallPaths beat={beat} local={local} />;
    case "outcome": return <OutcomeZones script={script} beat={beat} local={local} />;
    case "goals": return <GoalsBoard beat={beat} local={local} />;
    case "both": return <BothBoard script={script} beat={beat} local={local} />;
    case "duel": return <DuelBoard script={script} beat={beat} local={local} />;
    default: return null;
  }
}

function HookOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const sims = countTo(script.simulations, local, 12);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: CONTENT.top, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Tag>{beat.tag}</Tag>
      <div style={{ marginTop: 18, background: PANEL, borderRadius: 14, padding: "18px 30px 12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ ...numberFont, fontSize: 196, color: INK }}>{sims.toLocaleString("tr-TR")}</span>
        <span style={{ ...labelFont, fontSize: 60, color: GREEN_TEXT, marginTop: 4 }}>{upper(text(beat, "countLabel"))}</span>
      </div>
      <div style={{ marginTop: 22, background: PANEL, borderRadius: 14, padding: "12px 36px 10px", display: "flex", alignItems: "center", gap: 26 }}>
        <Img src={staticFile(script.home.logo)} style={{ width: 120, height: 120, objectFit: "contain" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Percent value={countTo(num(beat, "hero"), local, 10)} size={210} />
          <span style={{ ...labelFont, fontSize: 40, color: INK }}>{upper(text(beat, "heroLabel"))}</span>
        </div>
      </div>
    </div>
  );
}

function OutcomeOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const row = [
    { label: "BERABERLİK", value: num(beat, "draw"), logo: null },
    { label: upper(script.away.short), value: num(beat, "away"), logo: script.away.logo },
  ];
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: CONTENT.top, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <Tag>{beat.tag}</Tag>
      <Title>{upper(beat.title)}</Title>
      <div style={{ marginTop: 20, width: SAFE_WIDTH, boxSizing: "border-box", background: PANEL, borderRadius: 14, borderLeft: `10px solid ${GREEN}`, padding: "16px 28px 12px", display: "flex", alignItems: "center", gap: 28 }}>
        <Img src={staticFile(script.home.logo)} style={{ width: 130, height: 130, objectFit: "contain" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Percent value={countTo(num(beat, "home"), local)} size={250} />
          <span style={{ ...labelFont, fontSize: 48, color: INK }}>{upper(script.home.short)}</span>
        </div>
      </div>
      <div style={{ marginTop: 16, width: SAFE_WIDTH, display: "flex", gap: 16 }}>
        {row.map((item) => (
          <div key={item.label} style={{ flex: 1, background: PANEL, borderRadius: 14, padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 14 }}>
            {item.logo ? <Img src={staticFile(item.logo)} style={{ width: 72, height: 72, objectFit: "contain" }} /> : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Percent value={countTo(item.value, local)} size={120} />
              <span style={{ ...labelFont, fontSize: 36, color: INK }}>{item.label}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, width: SAFE_WIDTH, boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: "14px 24px 12px", ...labelFont, fontSize: 44, color: INK }}>
        {upper(text(beat, "because"))}
      </div>
    </div>
  );
}

export function Overlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  switch (beat.kind) {
    case "hook": return <HookOverlay script={script} beat={beat} local={local} />;
    case "outcome": return <OutcomeOverlay script={script} beat={beat} local={local} />;
    case "goals": return <GoalsOverlay beat={beat} local={local} />;
    case "both": return <BothOverlay script={script} beat={beat} local={local} />;
    case "why": return <WhyOverlay script={script} beat={beat} local={local} />;
    case "duel": return <DuelOverlay script={script} beat={beat} local={local} />;
    case "close": return <CloseOverlay script={script} beat={beat} local={local} />;
    default: return null;
  }
}

export const useLocal = (beat: Beat) => useCurrentFrame() - beat.from;
