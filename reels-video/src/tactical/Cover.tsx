import { AbsoluteFill, Img, staticFile } from "remotion";
import { GREEN, GREEN_TEXT, INK, bodyFont, labelFont, numberFont, upper } from "./parts";
import type { TacticalScript } from "./types";

/**
 * Taktik tahtası kapağı (kapak.png, 1080×1920; kullanıcı 2026-11-07). Videoyla aynı görsel dil: koyu zemin, bulanık stadyum,
 * ince saha çizgileri + ızgara, marka yeşili yalnız vurgu. Bütün içerik ortadaki 1080×1350 alanda (y 285–1635; profil ızgarası 4:5
 * kırpar). Rakam/yüzde, oyuncu fotoğrafı, yasal not YOK. Her şey betikten: takım, lig + hafta, tarih + saat, stadyum.
 */

export const COVER_SAFE = { top: 285, bottom: 1635 } as const;
const LOGO_WIDTH = 486; // ~%45
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 248) / 1269);

function Lines() {
  const w = 1080, h = 1920;
  const pitch = { x: 140, y: 300, w: 800, h: 1320 };
  const line = "rgba(236,244,238,0.13)";
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 17 }, (_, i) => <line key={`v${i}`} x1={(w / 18) * (i + 1)} y1={0} x2={(w / 18) * (i + 1)} y2={h} stroke="rgba(236,244,238,0.045)" strokeWidth={1.5} />)}
      {Array.from({ length: 31 }, (_, i) => <line key={`h${i}`} x1={0} y1={(h / 32) * (i + 1)} x2={w} y2={(h / 32) * (i + 1)} stroke="rgba(236,244,238,0.045)" strokeWidth={1.5} />)}
      <rect x={pitch.x} y={pitch.y} width={pitch.w} height={pitch.h} fill="none" stroke={line} strokeWidth={4} />
      <line x1={pitch.x} y1={pitch.y + pitch.h / 2} x2={pitch.x + pitch.w} y2={pitch.y + pitch.h / 2} stroke={line} strokeWidth={4} />
      <circle cx={w / 2} cy={pitch.y + pitch.h / 2} r={130} fill="none" stroke={line} strokeWidth={4} />
      {[0, 1].map((end) => (
        <g key={end}>
          <rect x={w / 2 - 250} y={end ? pitch.y + pitch.h - 220 : pitch.y} width={500} height={220} fill="none" stroke={line} strokeWidth={4} />
          <rect x={w / 2 - 120} y={end ? pitch.y + pitch.h - 80 : pitch.y} width={240} height={80} fill="none" stroke={line} strokeWidth={4} />
        </g>
      ))}
    </svg>
  );
}

function StadiumIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={GREEN_TEXT} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx={24} cy={30} rx={20} ry={9} />
      <path d="M4 30 V20 C4 15 13 11 24 11 C35 11 44 15 44 20 V30" />
      <ellipse cx={24} cy={30} rx={10} ry={4} />
      <path d="M10 13 V6 M38 13 V6 M24 11 V4" />
    </svg>
  );
}

function Team({ name, logo }: { name: string; logo: string }) {
  return (
    <div style={{ width: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <Img src={staticFile(logo)} style={{ width: 290, height: 290, objectFit: "contain", filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.6))" }} />
      <div style={{ ...labelFont, fontSize: 56, color: INK, textAlign: "center", lineHeight: 1.05 }}>{upper(name)}</div>
    </div>
  );
}

export function TacticalCover({ script }: { script: TacticalScript }) {
  return (
    <AbsoluteFill style={{ background: "#050B07", overflow: "hidden" }}>
      {script.backdrop ? <Img src={staticFile(script.backdrop)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(6px)", transform: "scale(1.04)" }} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,8,5,0.9) 0%, rgba(3,8,5,0.72) 35%, rgba(3,8,5,0.78) 65%, rgba(3,8,5,0.94) 100%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)" }} />
      <Lines />
      <AbsoluteFill style={{ top: COVER_SAFE.top, height: COVER_SAFE.bottom - COVER_SAFE.top, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "80px 0 70px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <Img src={staticFile("brand/checkmatch-logo.png")} style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ width: 56, height: 3, background: GREEN }} />
          <span style={{ ...labelFont, fontSize: 38, color: INK, letterSpacing: 8 }}>{upper(script.competitionLabel)}</span>
          <span style={{ width: 56, height: 3, background: GREEN }} />
        </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 18 }}>
          <Team name={script.home.name} logo={script.home.logo} />
          <div style={{ height: 290, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <span style={{ width: 3, height: 90, background: GREEN }} />
            <span style={{ ...labelFont, fontSize: 44, color: GREEN_TEXT }}>VS</span>
            <span style={{ width: 3, height: 90, background: GREEN }} />
          </div>
          <Team name={script.away.name} logo={script.away.logo} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <div style={{ ...numberFont, fontSize: 78, color: INK, letterSpacing: 1, whiteSpace: "nowrap" }}>{script.dateLabel}</div>
          {script.venue ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <StadiumIcon size={56} />
              <span style={{ ...labelFont, fontSize: 48, color: INK, letterSpacing: 4 }}>{upper(script.venue)}</span>
            </div>
          ) : null}
        </div>
        <div style={{ ...bodyFont, fontSize: 40, color: INK }}>{script.site}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
