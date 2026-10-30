import type { AnalysisEventKind } from "@/types/match-analysis";
import { BallIcon } from "../checkmatch-set/set-parts";
import { BODY } from "../match-day/shared";

/**
 * Zaman çizelgesi ikonları (Satori, programatik SVG): gol (top), penaltı golü (top + "P" rozeti), kendi kalesine
 * (kırmızı halkalı top), kaçan penaltı (soluk top + çarpı), sarı / ikinci sarı / kırmızı kart, değişiklik
 * (giren yeşil ↑ / çıkan kırmızı ↓), VAR (çerçeveli "VAR"). Vurgu rengi kullanılmaz — anlam ikonun kendisinde.
 */

const YELLOW = "#F7D117";
const RED = "#E63946";
const GREEN = "#2DC26B";

function CardIcon({ size, fill, back }: { size: number; fill: string; back?: string }) {
  const w = Math.round(size * 0.62);
  const h = Math.round(size * 0.84);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {back ? <rect x={Math.round(size * 0.08)} y={Math.round(size * 0.04)} width={w} height={h} rx={2} fill={back} /> : null}
      <rect x={Math.round(size * (back ? 0.3 : 0.19))} y={Math.round(size * (back ? 0.12 : 0.08))} width={w} height={h} rx={2} fill={fill} />
    </svg>
  );
}

function SubIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M7 20V7M3 11l4-4.5L11 11" stroke={GREEN} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 4v13M13 13l4 4.5 4-4.5" stroke={RED} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VarIcon({ size }: { size: number }) {
  return (
    <div tw="flex items-center justify-center" style={{ width: size, height: size }}>
      <div tw="flex items-center justify-center" style={{ height: Math.round(size * 0.66), paddingLeft: 2, paddingRight: 2, border: "2px solid rgba(255,255,255,0.9)", borderRadius: 3 }}>
        <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: Math.round(size * 0.36), lineHeight: 1, color: "#fff", letterSpacing: 0.5 }}>VAR</span>
      </div>
    </div>
  );
}

function PenaltyBall({ size, missed }: { size: number; missed: boolean }) {
  const badge = Math.round(size * 0.5);
  return (
    <div tw="flex relative" style={{ width: size, height: size }}>
      <div tw="flex" style={{ opacity: missed ? 0.45 : 1 }}>
        <BallIcon size={size} />
      </div>
      {missed ? (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M5 5l14 14M19 5L5 19" stroke={RED} strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <div tw="flex items-center justify-center" style={{ position: "absolute", right: -2, bottom: -2, width: badge, height: badge, borderRadius: badge / 2, backgroundColor: "#111" }}>
          <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: Math.round(badge * 0.72), lineHeight: 1, color: "#fff" }}>P</span>
        </div>
      )}
    </div>
  );
}

function OwnGoalBall({ size }: { size: number }) {
  return (
    <div tw="flex items-center justify-center" style={{ width: size, height: size, borderRadius: size / 2, border: `2px solid ${RED}` }}>
      <BallIcon size={size - 6} />
    </div>
  );
}

export function EventIcon({ kind, size }: { kind: AnalysisEventKind; size: number }) {
  switch (kind) {
    case "GOAL":
      return <BallIcon size={size} />;
    case "PENALTY_GOAL":
      return <PenaltyBall size={size} missed={false} />;
    case "MISSED_PENALTY":
      return <PenaltyBall size={size} missed />;
    case "OWN_GOAL":
      return <OwnGoalBall size={size} />;
    case "YELLOW":
      return <CardIcon size={size} fill={YELLOW} />;
    case "SECOND_YELLOW":
      return <CardIcon size={size} fill={RED} back={YELLOW} />;
    case "RED":
      return <CardIcon size={size} fill={RED} />;
    case "SUBSTITUTION":
      return <SubIcon size={size} />;
    case "VAR":
      return <VarIcon size={size} />;
  }
}
