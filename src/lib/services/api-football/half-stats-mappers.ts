import { parseStatValue } from "@/lib/dashboard/match-stats-rows";
import type { ApiFootballHalfTeamStatisticsRaw } from "@/lib/services/api-football/half-stats-types";
import { HALF_STAT_KEYS, type HalfRow, type HalfStatKey } from "@/types/match-analysis";

/**
 * API-Football devre istatistiği → 02 satırları (saf). Satır yalnızca İKİ yarıda İKİ takımın değeri de
 * okunduysa döner; biri null/eksikse satır düşer (0 yazılmaz, başka kaynaktan doldurulmaz — bkz.
 * `match-analysis/halves.ts`). Tip adları maç istatistiğiyle aynı (`post-match-stats-mappers.ts`).
 */

const TYPES: Record<HalfStatKey, string> = {
  possession: "Ball Possession",
  shotsTotal: "Total Shots",
  shotsOnTarget: "Shots on Goal",
  xg: "expected_goals",
  corners: "Corner Kicks",
};

type HalfBlock = "statistics_1h" | "statistics_2h";

function value(raw: readonly ApiFootballHalfTeamStatisticsRaw[], teamId: number, block: HalfBlock, type: string): number | null {
  const stats = raw.find((entry) => entry.team.id === teamId)?.[block] ?? [];
  return parseStatValue(stats.find((stat) => stat.type === type)?.value);
}

export function apiFootballHalfRows(raw: readonly ApiFootballHalfTeamStatisticsRaw[], ids: { home: number; away: number }): HalfRow[] {
  const rows: HalfRow[] = [];
  for (const key of HALF_STAT_KEYS) {
    const type = TYPES[key];
    const [h1, a1, h2, a2] = [value(raw, ids.home, "statistics_1h", type), value(raw, ids.away, "statistics_1h", type), value(raw, ids.home, "statistics_2h", type), value(raw, ids.away, "statistics_2h", type)];
    if (h1 === null || a1 === null || h2 === null || a2 === null) continue;
    rows.push({ key, first: { home: h1, away: a1 }, second: { home: h2, away: a2 } });
  }
  return rows;
}
