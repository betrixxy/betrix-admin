import type { StatRow } from "@/lib/dashboard/studio-render";
import type { DraftStatSelection } from "@/types/draft";
import type { MatchResultLetter, MatchStats, TeamRecentForm } from "@/types/sports";

/** Veri yoksa görselde gösterilen işaret — sıfır asla uydurulmaz (bkz. CLAUDE.md 2.4 madde 3). */
export const MISSING_STAT = "—";

export type StatSelection = DraftStatSelection;

/** Form harfleri Türkçe gösterilir: Galibiyet / Beraberlik / Mağlubiyet. */
export const FORM_LETTER_TR: Record<MatchResultLetter, string> = { W: "G", D: "B", L: "M" };

export const DEFAULT_STAT_SELECTION: StatSelection = {
  includeForm: true,
  includeGoals: true,
  includeXg: true,
  includeHeadToHead: false,
};

function decimal(value: number | null): string {
  return value === null ? MISSING_STAT : value.toFixed(2);
}

function formOf(team: TeamRecentForm): string {
  return team.last5.length > 0 ? team.last5.map((letter) => FORM_LETTER_TR[letter]).join("") : MISSING_STAT;
}

/**
 * Görselin veri katmanında gösterilecek satırlar — yalnızca seçilen, gerçek (API-Football)
 * istatistikler. Bir takımda metrik yoksa hücre "—" olur; iki takımda da yoksa satır atlanır.
 */
export function buildStatRows(stats: MatchStats, selection: StatSelection): StatRow[] {
  const { home, away, headToHead } = stats;
  const rows: StatRow[] = [];

  if (selection.includeForm) {
    rows.push({ label: "Son 5 Maç", home: formOf(home), away: formOf(away) });
  }
  if (selection.includeGoals) {
    rows.push({ label: "Gol (maç başı)", home: decimal(home.goalsForAvg), away: decimal(away.goalsForAvg) });
    rows.push({ label: "Yenilen gol", home: decimal(home.goalsAgainstAvg), away: decimal(away.goalsAgainstAvg) });
  }
  if (selection.includeXg && (home.xgForAvg !== null || away.xgForAvg !== null)) {
    rows.push({ label: "xG (maç başı)", home: decimal(home.xgForAvg), away: decimal(away.xgForAvg) });
    rows.push({ label: "xGA (maç başı)", home: decimal(home.xgAgainstAvg), away: decimal(away.xgAgainstAvg) });
  }
  if (selection.includeHeadToHead && headToHead.matches.length > 0) {
    rows.push({
      label: `Son ${headToHead.matches.length} karşılaşma · ${headToHead.draws} B`,
      home: `${headToHead.homeWins} G`,
      away: `${headToHead.awayWins} G`,
    });
  }

  return rows;
}

/** Form alanlarından (checkbox "on") seçim nesnesi. */
export function readStatSelection(formData: FormData): StatSelection {
  return {
    includeForm: formData.get("includeForm") === "on",
    includeGoals: formData.get("includeGoals") === "on",
    includeXg: formData.get("includeXg") === "on",
    includeHeadToHead: formData.get("includeHeadToHead") === "on",
  };
}
