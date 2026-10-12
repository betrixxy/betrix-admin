import { formatGoalDiff, type StandingsStatColumn, type StandingsStatKey } from "@/lib/dashboard/standings-layout";
import type { StandingRow, StandingZone } from "@/types/standings";
import { EYEBROW, SCORE, TEAM, upper } from "../deep-analysis/deep-analysis-tokens";
import type { WeeklyTheme } from "../weekly-fixtures/weekly-theme";

/**
 * Puan durumu satırı: [bölge çubuğu][sıra][logo][takım adı …][O · (G B M A Y) · AV][P]. Tipografi kesin
 * kuralı: takım adı Bricolage Grotesque ExtraBold (dar harf aralığı), sıra ve puan Archivo Black (büyük),
 * sütun başlıkları Space Mono. Puan, temanın skor kutusu renginde dolu bir hapın içindedir.
 */

export const RANK_WIDTH = 58;
const ZONE_BAR = 5;
const ROW_PAD_X = 14;
const GAP = 14;
/** Bricolage ExtraBold büyük harfte ortalama karakter genişliği / font boyutu (dar aralıkla). */
const CHAR_WIDTH_RATIO = 0.66;

const ZONE_COLORS: Record<Exclude<StandingZone, null>, string> = { top: "#22c55e", playoff: "#f59e0b", relegation: "#ef4444" };

/** Sütun genişliği: dar formatta (3 sütun) ferah, tam tabloda (8 sütun) sıkı; puan ve averaj biraz geniş. */
export function statWidth(key: StandingsStatKey, wide: boolean): number {
  if (key === "points") return wide ? 78 : 96;
  if (key === "goalDiff") return wide ? 66 : 80;
  return wide ? 50 : 66;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));

function nameWidthFor(columns: StandingsStatColumn[], wide: boolean, height: number, width: number): number {
  const statsWidth = columns.reduce((sum, column) => sum + statWidth(column.key, wide) + GAP, 0);
  return width - ZONE_BAR - ROW_PAD_X * 2 - RANK_WIDTH - Math.round(height * 0.6) - GAP * 3 - statsWidth;
}

/**
 * Tablonun tamamı için tek isim puntosu: en uzun ada göre (satırdan satıra değişen punto amatör durur);
 * alt sınırın altına düşen tek tük uzun ad üç noktayla kısalır.
 */
export function standingsNameSize(names: string[], columns: StandingsStatColumn[], wide: boolean, height: number, width: number): number {
  const nameWidth = nameWidthFor(columns, wide, height, width);
  const fits = names.map((name) => Math.floor(nameWidth / (Math.max(1, upper(name).length) * CHAR_WIDTH_RATIO)));
  return Math.max(16, Math.min(clamp(height * 0.46, 16, 30), ...fits));
}

/** Sütun başlıkları (her sütunun üstünde bir kez). */
export function StandingsHeaderRow({ columns, wide, height, theme }: { columns: StandingsStatColumn[]; wide: boolean; height: number; theme: WeeklyTheme }) {
  const label = { fontFamily: EYEBROW, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: theme.muted, lineHeight: 1 } as const;
  return (
    <div tw="flex items-center" style={{ height, padding: `0 ${ROW_PAD_X}px 0 ${ROW_PAD_X + ZONE_BAR}px`, gap: GAP }}>
      <span tw="flex justify-center" style={{ ...label, width: RANK_WIDTH }}>
        #
      </span>
      <span style={{ ...label, flex: 1 }}>TAKIM</span>
      {columns.map((column) => (
        <span key={column.key} tw="flex justify-center" style={{ ...label, width: statWidth(column.key, wide), color: column.key === "points" ? theme.accent : theme.muted }}>
          {column.label}
        </span>
      ))}
    </div>
  );
}

export function StandingsRow({
  row,
  logo,
  columns,
  wide,
  height,
  width,
  nameSize,
  theme,
}: {
  row: StandingRow;
  /** Gömülü (data URL) logo; okunamadıysa boş. */
  logo: string;
  columns: StandingsStatColumn[];
  wide: boolean;
  height: number;
  width: number;
  /** Tablo genelinde ortak isim puntosu (`standingsNameSize`). */
  nameSize: number;
  theme: WeeklyTheme;
}) {
  const logoSize = Math.round(height * 0.6);
  const name = upper(row.teamName);
  const statSize = clamp(height * 0.42, 15, 26);
  const pillHeight = Math.round(height * 0.72);

  return (
    <div
      tw="flex items-center"
      style={{ width, height, paddingRight: ROW_PAD_X, gap: GAP, borderRadius: 14, backgroundColor: theme.row, border: `1px solid ${theme.rowBorder}`, overflow: "hidden" }}
    >
      {/* Bölge çubuğu: Avrupa/terfi yeşil, play-off amber, küme düşme kırmızı. */}
      <div style={{ width: ZONE_BAR, height, backgroundColor: row.zone ? ZONE_COLORS[row.zone] : "rgba(0,0,0,0)" }} />
      <span tw="flex items-center justify-center" style={{ width: RANK_WIDTH - GAP + ROW_PAD_X, fontFamily: SCORE, fontSize: clamp(height * 0.5, 18, 34), lineHeight: 1, color: theme.text }}>
        {row.rank}
      </span>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img src={logo} alt="" width={logoSize} height={logoSize} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ width: logoSize, height: logoSize }} />
      )}
      <span
        style={{
          flex: 1,
          fontFamily: TEAM,
          fontWeight: 800,
          fontSize: nameSize,
          letterSpacing: -0.4,
          lineHeight: 1.05,
          color: theme.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </span>
      {columns.map((column) =>
        column.key === "points" ? (
          <div
            key={column.key}
            tw="flex items-center justify-center"
            style={{ width: statWidth(column.key, wide), height: pillHeight, borderRadius: 10, backgroundColor: theme.scoreBg }}
          >
            <span style={{ fontFamily: SCORE, fontSize: clamp(height * 0.48, 18, 32), lineHeight: 1, color: theme.scoreText }}>{row.points}</span>
          </div>
        ) : (
          <span
            key={column.key}
            tw="flex items-center justify-center"
            style={{ width: statWidth(column.key, wide), fontFamily: SCORE, fontSize: statSize, lineHeight: 1, color: column.key === "goalDiff" ? theme.text : theme.muted }}
          >
            {column.key === "goalDiff" ? formatGoalDiff(row.goalDiff) : row[column.key]}
          </span>
        ),
      )}
    </div>
  );
}
