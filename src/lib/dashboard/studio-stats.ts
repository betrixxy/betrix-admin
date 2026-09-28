import type { StatRow } from "@/lib/dashboard/studio-render";
import type { CalendarFixture } from "@/types/calendar";
import type { StudioMatchStats, StudioTeamStats } from "@/types/ai-content";

const FORM_LETTERS = ["W", "W", "D", "L", "W", "D"] as const;

/** FNV-1a + son karıştırma — kısa takım kimliklerinde bile birbirinden bağımsız değerler üretir. */
function hashOf(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;
  return hash >>> 0;
}

function mockTeamStats(teamId: string, teamName: string): StudioTeamStats {
    const form = Array.from({ length: 5 }, (_, i) => FORM_LETTERS[hashOf(`${teamId}:form:${i}`) % FORM_LETTERS.length]).join("");
  return {
    teamName,
    form,
    xgFor: 1 + (hashOf(`${teamId}:xgFor`) % 15) / 10,
    xgAgainst: 0.7 + (hashOf(`${teamId}:xgAgainst`) % 12) / 10,
  };
}

export interface StatSelection {
  includeForm: boolean;
  includeXg: boolean;
}

/** Görselin veri katmanında gösterilecek satırlar — yalnızca seçilen istatistikler. */
export function buildStatRows(stats: StudioMatchStats, selection: StatSelection): StatRow[] {
  const rows: StatRow[] = [];
  if (selection.includeForm) {
    rows.push({ label: "Son 5 Maç", home: stats.home.form, away: stats.away.form });
  }
  if (selection.includeXg) {
    rows.push({
      label: "xG (maç başı)",
      home: stats.home.xgFor.toFixed(2),
      away: stats.away.xgFor.toFixed(2),
    });
    rows.push({
      label: "xGA (maç başı)",
      home: stats.home.xgAgainst.toFixed(2),
      away: stats.away.xgAgainst.toFixed(2),
    });
  }
  return rows;
}

/**
 * Maç istatistiklerini üretir.
 *
 * MOCK: Sportmonks anahtarı bağlanana kadar takım kimliğinden türetilen, aynı maç için
 * hep aynı değeri veren örnek veri döner (bkz. CLAUDE.md 5.1 — önce mock ile geliştir).
 * Gerçek veri için burası `getTeamFormForFixture()` (lib/services/sportmonks) ile değişecek.
 */
export function getStudioMatchStats(fixture: CalendarFixture): StudioMatchStats {
  return {
    home: mockTeamStats(fixture.homeTeam.id, fixture.homeTeam.name),
    away: mockTeamStats(fixture.awayTeam.id, fixture.awayTeam.name),
    source: "mock",
  };
}
