import { upperTeamName, type NameOrigin } from "@/lib/dashboard/name-case";
import type { MatchCenter } from "@/lib/dashboard/weekly-fixtures-layout";
import type { WeeklyMatch, WeeklyTeam } from "@/types/weekly-fixtures";
import { EYEBROW, SCORE, TEAM } from "../deep-analysis/deep-analysis-tokens";
import type { WeeklyTheme } from "./weekly-theme";

/**
 * Tek maç satırı: [Ev sahibi adı · logo] [saat / skor] [logo · Deplasman adı]. Takım adları Bricolage
 * Grotesque ExtraBold (sıkı harf aralığı), saat ve skor Archivo Black, küçük notlar Space Mono.
 */

export const CENTER_WIDTH = 156;
const SIDE_GAP = 16;
const ROW_PAD_X = 18;
/** Bricolage ExtraBold büyük harfte ortalama karakter genişliği / font boyutu (+ harf aralığı payı). */
const CHAR_WIDTH_RATIO = 0.7;
const NAME_MIN_FONT = 16;

function nameFont(name: string, available: number, base: number): number {
  return Math.max(NAME_MIN_FONT, Math.min(base, Math.floor(available / (Math.max(1, name.length) * CHAR_WIDTH_RATIO))));
}

/** Bitmiş maçta kaybeden takım soluk yazılır; beraberlikte ve oynanmamış maçta ikisi de tam renk. */
function lost(team: WeeklyTeam, other: WeeklyTeam, match: WeeklyMatch): boolean {
  return match.status === "finished" && team.goals !== null && other.goals !== null && team.goals < other.goals;
}

function Side({ team, logo, align, rowHeight, sideWidth, theme, faded, nameOrigin }: { team: WeeklyTeam; logo: string; align: "home" | "away"; rowHeight: number; sideWidth: number; theme: WeeklyTheme; faded: boolean; nameOrigin: NameOrigin }) {
  const logoSize = Math.round(rowHeight * 0.6);
  // Takım adı köken kuralıyla (lig varsayılanı, bkz. name-case.ts).
  const name = upperTeamName(team.name, { name: nameOrigin, people: nameOrigin });
  const fontSize = nameFont(name, sideWidth - logoSize - 14, Math.max(20, Math.min(30, Math.round(rowHeight * 0.33))));
  const label = (
    <span
      style={{
        fontFamily: TEAM,
        fontWeight: 800,
        fontSize,
        letterSpacing: -0.4,
        lineHeight: 1.05,
        color: faded ? theme.muted : theme.text,
        maxWidth: sideWidth - logoSize - 14,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {name}
    </span>
  );
  const image = logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    <img src={logo} alt="" width={logoSize} height={logoSize} style={{ objectFit: "contain" }} />
  ) : (
    <div style={{ width: logoSize, height: logoSize }} />
  );
  return (
    <div tw="flex items-center" style={{ width: sideWidth, gap: 14, justifyContent: align === "home" ? "flex-end" : "flex-start" }}>
      {align === "home" ? label : image}
      {align === "home" ? image : label}
    </div>
  );
}

function Center({ center, rowHeight, theme }: { center: MatchCenter; rowHeight: number; theme: WeeklyTheme }) {
  const height = Math.min(64, rowHeight - 14);
  const primarySize = center.kind === "status" ? 17 : Math.max(24, Math.min(38, Math.round(rowHeight * 0.4)));
  const box =
    center.kind === "score"
      ? { backgroundColor: theme.scoreBg, border: `2px solid ${theme.scoreBg}`, color: theme.scoreText }
      : center.kind === "time"
        ? { backgroundColor: theme.timeBg, border: `2px solid ${theme.timeBorder}`, color: theme.timeText }
        : { backgroundColor: "rgba(0,0,0,0)", border: `2px solid ${theme.rowBorder}`, color: theme.muted };
  return (
    <div tw="flex flex-col items-center justify-center" style={{ width: CENTER_WIDTH, height, borderRadius: 12, gap: 3, ...box }}>
      <span tw="flex items-center justify-center" style={{ fontFamily: center.kind === "status" ? EYEBROW : SCORE, fontWeight: center.kind === "status" ? 700 : 400, fontSize: primarySize, letterSpacing: center.kind === "status" ? 2 : 0, lineHeight: 1 }}>
        {center.primary}
      </span>
      {center.note && height >= 50 ? (
        <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 11, letterSpacing: 2, lineHeight: 1, opacity: 0.8 }}>{center.note}</span>
      ) : null}
    </div>
  );
}

export function WeeklyRow({
  match,
  center,
  logos,
  rowHeight,
  width,
  theme,
  nameOrigin,
}: {
  match: WeeklyMatch;
  center: MatchCenter;
  logos: { home: string; away: string };
  rowHeight: number;
  width: number;
  theme: WeeklyTheme;
  /** Takım adlarının varsayılan kökeni (ligden, bkz. leagues.ts::nameOrigin). */
  nameOrigin: NameOrigin;
}) {
  const sideWidth = Math.floor((width - ROW_PAD_X * 2 - CENTER_WIDTH - SIDE_GAP * 2) / 2);
  return (
    <div
      tw="flex items-center"
      style={{ width, height: rowHeight, padding: `0 ${ROW_PAD_X}px`, gap: SIDE_GAP, borderRadius: 16, backgroundColor: theme.row, border: `1px solid ${theme.rowBorder}` }}
    >
      <Side team={match.home} logo={logos.home} align="home" rowHeight={rowHeight} sideWidth={sideWidth} theme={theme} faded={lost(match.home, match.away, match)} nameOrigin={nameOrigin} />
      <Center center={center} rowHeight={rowHeight} theme={theme} />
      <Side team={match.away} logo={logos.away} align="away" rowHeight={rowHeight} sideWidth={sideWidth} theme={theme} faded={lost(match.away, match.home, match)} nameOrigin={nameOrigin} />
    </div>
  );
}
