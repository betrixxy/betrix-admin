import type { TeamAnalysisDraft } from "@/types/deep-analysis";
import { BODY, EYEBROW, GRAY, GREEN_BR, MAX_WIDTH, NAVY_700, PANEL, SCORE, YELLOW, upper } from "./deep-analysis-tokens";

/**
 * Kartın bölüm bileşenleri (Satori) — kaynak: team-analysis/template.html sınıfları. `s` ölçeği (4:5 = 1)
 * küçük formatlarda (1:1) punto, boşluk ve görsel ölçüsünü birlikte küçültür. `stacked` = dar sütunda alt alta
 * (yan yana satırdaki `flex: 1` dikey sütunda yüksekliği sıfırlar).
 */

const fill = (stacked: boolean) => (stacked ? { width: "100%", flexShrink: 0 } : { flex: 1 });

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

export function PointColumn({ title, color, points, glyph, s = 1, stacked = false }: { title: string; color: string; points: string[]; glyph: React.ReactNode; s?: number; stacked?: boolean }) {
  return (
    <div tw="flex flex-col" style={{ ...fill(stacked), ...PANEL, padding: `${Math.round(20 * s)}px ${Math.round(22 * s)}px` }}>
      <div tw="flex" style={{ marginBottom: Math.round(12 * s) }}>
        <Eyebrow color={color} size={14 * s}>
          {title}
        </Eyebrow>
      </div>
      <div tw="flex flex-col" style={{ gap: Math.round(9 * s) }}>
        {points.map((point, index) => (
          <div key={index} tw="flex" style={{ position: "relative", paddingLeft: 26 }}>
            {glyph}
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18.5 * s, lineHeight: 1.3, color: "white" }}>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeyPlayer({ name, role, photoUrl, s = 1, stacked = false }: TeamAnalysisDraft["keyPlayers"][number] & { s?: number; stacked?: boolean }) {
  const photo = Math.round(56 * s);
  return (
    <div tw="flex items-start" style={{ ...fill(stacked), ...PANEL, padding: `${Math.round(14 * s)}px ${Math.round(16 * s)}px`, gap: Math.round(12 * s) }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img
          src={photoUrl}
          alt=""
          width={photo}
          height={photo}
          style={{ width: photo, height: photo, borderRadius: photo / 2, objectFit: "cover", border: `2px solid ${GREEN_BR}`, backgroundColor: NAVY_700, flexShrink: 0 }}
        />
      ) : null}
      <div tw="flex flex-col" style={{ flex: 1 }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 16.5 * s, color: "white", marginBottom: 3 }}>{upper(name)}</span>
        {role ? <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 14.5 * s, lineHeight: 1.32, color: GRAY }}>{role}</span> : null}
      </div>
    </div>
  );
}

export function StatRow({ stats, s = 1 }: { stats: TeamAnalysisDraft["stats"]; s?: number }) {
  return (
    <div
      tw="flex items-center"
      style={{ width: "100%", maxWidth: MAX_WIDTH, padding: `${Math.round(18 * s)}px 0`, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}
    >
      {stats.map((stat, index) => (
        <div key={index} tw="flex items-center" style={{ flex: 1 }}>
          {index > 0 ? <div style={{ width: 1, height: Math.round(58 * s), backgroundColor: "rgba(255,255,255,0.14)" }} /> : null}
          <div tw="flex flex-col items-center" style={{ flex: 1, padding: "0 10px" }}>
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 12 * s, letterSpacing: 0.8, color: GRAY, opacity: 0.75, marginBottom: Math.round(6 * s) }}>
              {upper(stat.label)}
            </span>
            <span style={{ fontFamily: SCORE, fontSize: 27 * s, color: "white" }}>{stat.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

