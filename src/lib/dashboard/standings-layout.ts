import { weeklyLayout, type WeeklyLayout } from "@/lib/dashboard/weekly-fixtures-layout";
import type { SupportedLeagueId } from "@/lib/services/api-football/leagues";
import type { Result } from "@/types/result";
import { ALL_GROUPS, type StandingRow, type StandingsDraft, type StandingsGroup } from "@/types/standings";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * "Puan Durumu" kartının saf yerleşim kuralları (istemci ve şablon da içe aktarır). Çerçeve (başlık,
 * gövde, imza bandı, güvenli alanlar, sütun sayısı) Haftanın Maçları ile birebir aynıdır (`weeklyLayout`).
 */

export type StandingsStatKey = "played" | "win" | "draw" | "lose" | "goalsFor" | "goalsAgainst" | "goalDiff" | "points";

export interface StandingsStatColumn {
  key: StandingsStatKey;
  /** Tablo başlığı (Space Mono): O, G, B, M, A, Y, AV, P. */
  label: string;
  /** Lejantta açık adı. */
  name: string;
}

const STAT_COLUMNS: Record<StandingsStatKey, StandingsStatColumn> = {
  played: { key: "played", label: "O", name: "Oynanan" },
  win: { key: "win", label: "G", name: "Galibiyet" },
  draw: { key: "draw", label: "B", name: "Beraberlik" },
  lose: { key: "lose", label: "M", name: "Mağlubiyet" },
  goalsFor: { key: "goalsFor", label: "A", name: "Attığı" },
  goalsAgainst: { key: "goalsAgainst", label: "Y", name: "Yediği" },
  goalDiff: { key: "goalDiff", label: "AV", name: "Averaj" },
  points: { key: "points", label: "P", name: "Puan" },
};

/** Dar formatlarda (4:5, 9:16, 1:1) tablo boğulmasın diye yalnızca O · AV · P; yatayda tam tablo. */
export function standingsStatColumns(format: SocialFormatId): StandingsStatColumn[] {
  const keys: StandingsStatKey[] =
    format === "landscape" ? ["played", "win", "draw", "lose", "goalsFor", "goalsAgainst", "goalDiff", "points"] : ["played", "goalDiff", "points"];
  return keys.map((key) => STAT_COLUMNS[key]);
}

export interface StandingsLayout extends WeeklyLayout {
  /** Her sütunun üstündeki O/G/B/P başlık satırı. */
  tableHeader: number;
}

const ROWS = { tableHeader: 34, sectionHeader: 40, sectionGap: 14, rowGap: 6, minRow: 34, maxRow: 76 } as const;
/** Story: güvenli alan içindeki yükseklik satırlara ve aralıklara yayılır — kısa tabloda satırlar büyür, blok ortalanır. */
const STORY_ROWS = { tableHeader: 40, sectionHeader: 44, sectionGap: 20, rowGap: 8, minRow: 34, maxRow: 100 } as const;

export function standingsLayout(format: SocialFormatId): StandingsLayout {
  return { ...weeklyLayout(format), ...(format === "story" ? STORY_ROWS : ROWS) };
}

const rowCount = (sections: StandingsGroup[]) => sections.reduce((sum, section) => sum + section.rows.length, 0);

/**
 * Bölümleri sütunlara dağıtır: her sütun ~eşit sayıda takım alır (20 takım → 1-10 / 11-20), sütun sınırına
 * denk gelen bölüm bölünür ve yeni sütunda aynı başlıkla sürer.
 */
export function standingsColumns(sections: StandingsGroup[], columns: number): StandingsGroup[][] {
  const total = rowCount(sections);
  if (columns <= 1 || total === 0) return [sections];
  const target = Math.ceil(total / columns);
  const result: StandingsGroup[][] = [[]];
  let filled = 0;
  for (const section of sections) {
    let rest = section.rows;
    let part = 0;
    while (rest.length > 0) {
      if (filled >= target && result.length < columns) {
        result.push([]);
        filled = 0;
      }
      const take = result.length >= columns ? rest.length : Math.min(rest.length, target - filled);
      result.at(-1)?.push({ key: part === 0 ? section.key : `${section.key}:${part}`, label: section.label, rows: rest.slice(0, take) });
      rest = rest.slice(take);
      filled += take;
      part += 1;
    }
  }
  return result.filter((column) => column.length > 0);
}

/** Tek sütunun satır yüksekliği; sığmıyorsa null. */
function columnRowHeight(column: StandingsGroup[], layout: StandingsLayout): number | null {
  const rows = rowCount(column);
  if (rows === 0) return null;
  const labeled = column.filter((section) => section.label).length;
  const fixed = layout.tableHeader + labeled * layout.sectionHeader + Math.max(0, column.length - 1) * layout.sectionGap + (rows - 1) * layout.rowGap;
  const row = Math.floor((layout.bodyBottom - layout.bodyTop - fixed) / rows);
  return row < layout.minRow ? null : Math.min(layout.maxRow, row);
}

export interface StandingsPlan {
  columns: StandingsGroup[][];
  rowHeight: number;
  /** En uzun sütunun çizilen yüksekliği (başlık satırı dahil) — Story'de gövde buna göre ortalanır. */
  height: number;
}

function columnHeight(column: StandingsGroup[], rowHeight: number, layout: StandingsLayout): number {
  const rows = rowCount(column);
  const labeled = column.filter((section) => section.label).length;
  return layout.tableHeader + labeled * layout.sectionHeader + Math.max(0, column.length - 1) * layout.sectionGap + rows * rowHeight + Math.max(0, rows - 1) * layout.rowGap;
}

/** Kartın yerleşim planı (sütunlar + ortak satır yüksekliği); tablo bu formata sığmıyorsa null. */
export function standingsPlan(sections: StandingsGroup[], layout: StandingsLayout): StandingsPlan | null {
  const columns = standingsColumns(sections, layout.columns);
  if (columns.length === 0) return null;
  const heights = columns.map((column) => columnRowHeight(column, layout));
  if (heights.some((height) => height === null)) return null;
  const rowHeight = Math.min(...heights.filter((height) => height !== null));
  return { columns, rowHeight, height: Math.max(...columns.map((column) => columnHeight(column, rowHeight, layout))) };
}

/** Bu formatta tek tablodan sığan en fazla takım (form "sıra aralığı" önerisi için). */
export function standingsCapacity(format: SocialFormatId): number {
  const layout = standingsLayout(format);
  let fits = 0;
  for (let rows = 1; rows <= 64; rows += 1) {
    const section = { key: "x", label: "", rows: Array.from({ length: rows }, (_, i) => ({ rank: i + 1 }) as StandingRow) };
    if (!standingsPlan([section], layout)) break;
    fits = rows;
  }
  return fits;
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

/** "AV" sütunu ve gönderi metni için işaretli averaj: +12, 0, -4. */
export function formatGoalDiff(value: number): string {
  return signed(value);
}

/** Gönderi metni: başlık + bölüm bölüm "1. Galatasaray — 25 P (8 O, +18 AV)". */
export function standingsCaption(leagueName: string, seasonLabel: string, title: string, sections: StandingsGroup[]): string {
  const lines = [`${leagueName} ${seasonLabel} | ${title}`];
  for (const section of sections) {
    if (section.label) lines.push("", section.label);
    else lines.push("");
    for (const row of section.rows) lines.push(`${row.rank}. ${row.teamName} — ${row.points} P (${row.played} O, ${signed(row.goalDiff)} AV)`);
  }
  return lines.join("\n");
}

/** "2025" → "2025/26". */
export function seasonLabel(season: number): string {
  return `${season}/${String(season + 1).slice(2)}`;
}

const CUP_LEAGUES: ReadonlySet<SupportedLeagueId> = new Set(["ucl", "uel", "uecl"]);

/** Başlığın altındaki etiket: grup aşamasında "GRUP AŞAMASI", tabloda oynanan en çok maça göre "8. HAFTA SONU". */
export function standingsKindLabel(leagueId: SupportedLeagueId, sections: StandingsGroup[]): string {
  if (sections.some((section) => section.label.endsWith("GRUBU"))) return "GRUP AŞAMASI";
  const played = Math.max(0, ...sections.flatMap((section) => section.rows.map((row) => row.played)));
  if (played === 0) return "SEZON ÖNCESİ";
  return `${played}. ${CUP_LEAGUES.has(leagueId) ? "MAÇ GÜNÜ" : "HAFTA"} SONU`;
}

/** Seçilen bölümler: tüm gruplar ya da tek tablo/grup (sıra aralığı yalnızca tek tabloda uygulanır). */
export function selectSections(groups: StandingsGroup[], draft: Pick<StandingsDraft, "groupKey" | "rankFrom" | "rankTo">): Result<StandingsGroup[]> {
  if (draft.groupKey === ALL_GROUPS) return { ok: true, data: groups };
  const group = groups.find((candidate) => candidate.key === draft.groupKey);
  if (!group) return { ok: false, error: { code: "INVALID_INPUT", message: "Seçilen grup bu sezonun tablosunda yok — listeyi yenileyin." } };
  const rows = group.rows.filter((row) => row.rank >= draft.rankFrom && row.rank <= draft.rankTo);
  if (rows.length === 0) return { ok: false, error: { code: "INVALID_INPUT", message: "Seçilen sıra aralığında takım yok." } };
  return { ok: true, data: [{ ...group, rows }] };
}
