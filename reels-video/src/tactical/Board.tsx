import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "../lib/motion";
import { PITCH } from "./camera";
import type { Camera, Side, TacticalPlayer, TacticalScript } from "./types";

/**
 * Kalıcı taktik tahtası: perspektifli saha (CSS 3D), video boyunca tek. Ev sahibi alttan yukarı, deplasman yukarıdan aşağı oynar.
 * Zemin: bulanık stadyum fotoğrafı + koyu gradyan, video boyunca %100 → %108 Ken Burns; fotoğraf yoksa koyu çim dokusu.
 */

const LINE = "rgba(236,244,238,0.55)";

/** Oyuncunun saha düzlemindeki yeri (px, sol üst köşe 0,0). Ev sahibi alt yarı; hat 1 kaleci. */
export function playerPoint(player: TacticalPlayer, side: Side): { x: number; y: number } {
  const depth = player.lines > 1 ? (player.line - 1) / (player.lines - 1) : 0;
  const fromGoal = 70 + depth * (PITCH.height / 2 - 150);
  const across = (player.column / (player.columns + 1)) * PITCH.width;
  // Ev sahibi alttan bakar: 1. sütun sol. Deplasman karşıdan bakar: ekranda aynalanır.
  return side === "home" ? { x: across, y: PITCH.height - fromGoal } : { x: PITCH.width - across, y: fromGoal };
}

function PitchLines() {
  const { width: w, height: h } = PITCH;
  const box = { w: w * 0.6, h: h * 0.16 };
  const six = { w: w * 0.28, h: h * 0.055 };
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {/* İnce ölçü ızgarası */}
      {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={(w / 12) * (i + 1)} y1={0} x2={(w / 12) * (i + 1)} y2={h} stroke="rgba(236,244,238,0.07)" strokeWidth={1.5} />)}
      {Array.from({ length: 17 }, (_, i) => <line key={`h${i}`} x1={0} y1={(h / 18) * (i + 1)} x2={w} y2={(h / 18) * (i + 1)} stroke="rgba(236,244,238,0.07)" strokeWidth={1.5} />)}
      <rect x={3} y={3} width={w - 6} height={h - 6} fill="none" stroke={LINE} strokeWidth={5} />
      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={LINE} strokeWidth={5} />
      <circle cx={w / 2} cy={h / 2} r={w * 0.14} fill="none" stroke={LINE} strokeWidth={5} />
      <circle cx={w / 2} cy={h / 2} r={7} fill={LINE} />
      {[0, 1].map((end) => {
        const y = end ? h - box.h : 0;
        const sy = end ? h - six.h : 0;
        return (
          <g key={end}>
            <rect x={(w - box.w) / 2} y={y} width={box.w} height={box.h} fill="none" stroke={LINE} strokeWidth={5} />
            <rect x={(w - six.w) / 2} y={sy} width={six.w} height={six.h} fill="none" stroke={LINE} strokeWidth={5} />
            <rect x={(w - w * 0.12) / 2} y={end ? h - 2 : -16} width={w * 0.12} height={18} fill="rgba(236,244,238,0.85)" />
          </g>
        );
      })}
    </svg>
  );
}

export function Dot({ player, side, team, dim = 1, showName = false }: { player: TacticalPlayer; side: Side; team: TacticalScript["home"]; dim?: number; showName?: boolean }) {
  const { x, y } = playerPoint(player, side);
  const fill = player.out ? "#6B716E" : team.primary;
  return (
    <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, opacity: dim }}>
      <div data-dot={`${side}-${player.number ?? player.id}`} style={{ width: 68, height: 68, borderRadius: 34, background: fill, border: `6px solid ${player.out ? "#9AA09D" : team.secondary}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(0,0,0,0.55)" }}>
        <span style={{ fontFamily: "Barlow Condensed", fontWeight: 900, fontSize: 34, color: "#FFFFFF", fontVariantNumeric: "tabular-nums", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{player.number ?? ""}</span>
      </div>
      {player.out ? (
        <svg width={68} height={68} style={{ position: "absolute", inset: 0 }}><path d="M16 16 L52 52 M52 16 L16 52" stroke="#E5252A" strokeWidth={9} strokeLinecap="round" /></svg>
      ) : null}
      {showName ? (
        <div style={{ position: "absolute", top: 72, left: -80, width: 228, textAlign: "center", fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 34, color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>{player.name}</div>
      ) : null}
    </div>
  );
}

export function Board({ script, camera, children }: { script: TacticalScript; camera: Camera; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const kenBurns = interpolate(frame, [0, Math.max(1, script.durationInFrames - 1)], [1, 1.08]);
  const left = (WIDTH - PITCH.width) / 2;
  const top = (HEIGHT - PITCH.height) / 2;
  return (
    <AbsoluteFill style={{ background: "#07110B", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${kenBurns})` }}>
        {script.backdrop ? (
          <Img src={staticFile(script.backdrop)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, #0C1F12 0px, #0C1F12 60px, #0E2415 60px, #0E2415 120px)" }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,8,5,0.82) 0%, rgba(3,8,5,0.55) 40%, rgba(3,8,5,0.6) 70%, rgba(3,8,5,0.9) 100%)" }} />
      <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: "50% 40%" }}>
        <div
          style={{
            position: "absolute", left, top, width: PITCH.width, height: PITCH.height,
            transform: `translate(${camera.panX}px, ${camera.panY}px) rotateX(${camera.tilt}deg) rotateZ(${camera.rotate}deg) scale(${camera.zoom})`,
            transformStyle: "preserve-3d",
            background: "linear-gradient(180deg, rgba(20,64,34,0.55), rgba(14,48,26,0.55))",
            boxShadow: "0 0 120px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 85px, rgba(0,0,0,0.04) 85px, rgba(0,0,0,0.04) 170px)" }} />
          <PitchLines />
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
