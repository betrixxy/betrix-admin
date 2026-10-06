import type { TeamAnalysisDraft } from "@/types/deep-analysis";
import { BODY, EYEBROW, GRAY, GREEN_BR, MAX_WIDTH, NAVY_700, PANEL, SCORE, YELLOW, upper } from "./deep-analysis-tokens";

/** Kartın bölüm bileşenleri (Satori) — kaynak: team-analysis/template.html sınıfları. */

export function Eyebrow({ children, color, size = 14, spacing = 1.2, opacity = 1 }: { children: string; color: string; size?: number; spacing?: number; opacity?: number }) {
  return <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: size, letterSpacing: spacing, color, opacity }}>{upper(children)}</span>;
}

export function CheckGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ position: "absolute", left: 0, top: 3 }}>
      <path d="M2.5 9.5l4 4L15.5 3.5" fill="none" stroke={GREEN_BR} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BangGlyph() {
  return (
    <span style={{ position: "absolute", left: 3, top: 0, fontFamily: BODY, fontWeight: 800, fontSize: 17, color: YELLOW }}>!</span>
  );
}

export function GearGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" style={{ marginRight: 9 }}>
      <circle cx="12" cy="12" r="7.5" fill="none" stroke={YELLOW} strokeWidth="2.6" strokeDasharray="3.2 2.7" />
      <circle cx="12" cy="12" r="4.6" fill="none" stroke={YELLOW} strokeWidth="2.2" />
      <circle cx="12" cy="12" r="1.6" fill={YELLOW} />
    </svg>
  );
}

export function PointColumn({ title, color, points, glyph }: { title: string; color: string; points: string[]; glyph: React.ReactNode }) {
  return (
    <div tw="flex flex-col" style={{ flex: 1, ...PANEL, padding: "20px 22px" }}>
      <div tw="flex" style={{ marginBottom: 12 }}>
        <Eyebrow color={color}>{title}</Eyebrow>
      </div>
      <div tw="flex flex-col" style={{ gap: 9 }}>
        {points.map((point, index) => (
          <div key={index} tw="flex" style={{ position: "relative", paddingLeft: 26 }}>
            {glyph}
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18.5, lineHeight: 1.3, color: "white" }}>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeyPlayer({ name, role, photoUrl }: TeamAnalysisDraft["keyPlayers"][number]) {
  return (
    <div tw="flex items-start" style={{ flex: 1, ...PANEL, padding: "14px 16px", gap: 12 }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img
          src={photoUrl}
          alt=""
          width={56}
          height={56}
          style={{ width: 56, height: 56, borderRadius: 28, objectFit: "cover", border: `2px solid ${GREEN_BR}`, backgroundColor: NAVY_700, flexShrink: 0 }}
        />
      ) : null}
      <div tw="flex flex-col" style={{ flex: 1 }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 16.5, color: "white", marginBottom: 3 }}>{upper(name)}</span>
        {role ? <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14.5, lineHeight: 1.32, color: GRAY }}>{role}</span> : null}
      </div>
    </div>
  );
}

export function StatRow({ stats }: { stats: TeamAnalysisDraft["stats"] }) {
  return (
    <div
      tw="flex items-center"
      style={{ width: "100%", maxWidth: MAX_WIDTH, padding: "18px 0", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}
    >
      {stats.map((stat, index) => (
        <div key={index} tw="flex items-center" style={{ flex: 1 }}>
          {index > 0 ? <div style={{ width: 1, height: 58, backgroundColor: "rgba(255,255,255,0.14)" }} /> : null}
          <div tw="flex flex-col items-center" style={{ flex: 1, padding: "0 10px" }}>
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 12, letterSpacing: 0.8, color: GRAY, opacity: 0.75, marginBottom: 6 }}>
              {upper(stat.label)}
            </span>
            <span style={{ fontFamily: SCORE, fontSize: 27, color: "white" }}>{stat.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

