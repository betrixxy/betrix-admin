import { parseStatValue, STAT_ROWS } from "@/lib/dashboard/match-stats-rows";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { SportmonksMatchValues } from "@/lib/services/sportmonks/match-stats-mappers";
import { STAT_ROW_KEYS, type MatchStatsFacts, type StatRowKey, type StatRowValue } from "@/types/match-stats";

/**
 * Maç İstatistikleri: ham bitmiş maç (`/fixtures?id=` — statistics + players içinde) + aynı maçın
 * Sportmonks değerleri → kanonik `MatchStatsFacts` (saf). Skor, golcüler ve kart sayıları Maç
 * Sonucu ile aynı kaynaktan (API-Football, `toMatchResultFacts`) gelir — set kartları çelişemez.
 * Sportmonks yalnızca API-Football'un null bıraktığı satırları doldurur; ikisinde de yoksa satır
 * gizlenir (sıfır yazılmaz). Kart sayıları iki kaynakta farklıysa uyarı üretilir, sessizce seçilmez.
 * Büyük fırsat ve direkten dönen yalnızca Sportmonks'ta vardır (bkz. CLAUDE.md 2.1).
 */

const API_FOOTBALL_TYPES: Partial<Record<StatRowKey, string>> = {
  possession: "Ball Possession",
  xg: "expected_goals",
  shotsTotal: "Total Shots",
  shotsOnTarget: "Shots on Goal",
  shotsOffTarget: "Shots off Goal",
  shotsBlocked: "Blocked Shots",
  shotsInsideBox: "Shots insidebox",
  corners: "Corner Kicks",
  offsides: "Offsides",
  fouls: "Fouls",
  yellowCards: "Yellow Cards",
  redCards: "Red Cards",
  saves: "Goalkeeper Saves",
  passes: "Total passes",
  passAccuracy: "Passes %",
};

type Pair = { home: number; away: number };

function teamStat(raw: ApiFootballFixtureResultRaw, teamId: number, type: string): number | null {
  const stats = raw.statistics.find((entry) => entry.team.id === teamId)?.statistics ?? [];
  return parseStatValue(stats.find((stat) => stat.type === type)?.value);
}

/**
 * "Top çalma ve müdahale" = takımın oyuncularının `tackles.total + tackles.interceptions` toplamı.
 * Oyuncu verisi yoksa ya da hiçbir oyuncuda alan dolu değilse `null` (0 sayılmaz).
 */
export function tacklesAndInterceptions(raw: ApiFootballFixtureResultRaw, teamId: number): number | null {
  const players = raw.players.find((entry) => entry.team.id === teamId)?.players ?? [];
  let total = 0;
  let seen = false;
  for (const { statistics } of players) {
    const tackles = statistics[0]?.tackles;
    for (const part of [tackles?.total, tackles?.interceptions]) {
      if (typeof part === "number") {
        total += part;
        seen = true;
      }
    }
  }
  return seen ? total : null;
}

function apiFootballPair(raw: ApiFootballFixtureResultRaw, key: StatRowKey): Pair | null {
  const [homeId, awayId] = [raw.teams.home.id, raw.teams.away.id];
  if (key === "tacklesInterceptions") {
    const [home, away] = [tacklesAndInterceptions(raw, homeId), tacklesAndInterceptions(raw, awayId)];
    return home === null || away === null ? null : { home, away };
  }
  const type = API_FOOTBALL_TYPES[key];
  if (!type) return null;
  const [home, away] = [teamStat(raw, homeId, type), teamStat(raw, awayId, type)];
  return home === null || away === null ? null : { home, away };
}

export function statRows(raw: ApiFootballFixtureResultRaw, sportmonks: SportmonksMatchValues | null): StatRowValue[] {
  const rows: StatRowValue[] = [];
  for (const key of STAT_ROW_KEYS) {
    const primary = apiFootballPair(raw, key);
    if (primary) {
      rows.push({ key, ...primary, source: "api-football" });
      continue;
    }
    const fallback = sportmonks?.[key];
    if (fallback) rows.push({ key, home: fallback.home, away: fallback.away, source: "sportmonks" });
  }
  return rows;
}

/** Çapraz kontrol edilen satırlar: kart sayıları (CLAUDE.md 2.1 — kritik veri noktası). */
const CROSS_CHECKED: StatRowKey[] = ["yellowCards", "redCards"];

/** API-Football'un kullanılan değeri Sportmonks'la çelişiyorsa: "Kırmızı kart: API-Football 0-1, Sportmonks 0-2". */
export function cardConflicts(raw: ApiFootballFixtureResultRaw, sportmonks: SportmonksMatchValues | null): string[] {
  const warnings: string[] = [];
  for (const key of CROSS_CHECKED) {
    const primary = apiFootballPair(raw, key);
    const other = sportmonks?.[key];
    if (!primary || !other || (primary.home === other.home && primary.away === other.away)) continue;
    warnings.push(`${STAT_ROWS[key].label}: API-Football ${primary.home}-${primary.away}, Sportmonks ${other.home}-${other.away} — kartta API-Football değeri kullanıldı, kontrol edin.`);
  }
  return warnings;
}

/** Bitmemiş maç için null — kart yalnızca kesinleşmiş skorla üretilir (Maç Sonucu ile aynı kural). */
export function toMatchStatsFacts(raw: ApiFootballFixtureResultRaw, sportmonks: SportmonksMatchValues | null): MatchStatsFacts | null {
  const result = toMatchResultFacts(raw);
  if (!result) return null;
  return {
    fixtureId: result.fixtureId,
    kickoffUtc: result.kickoffUtc,
    statusShort: result.statusShort,
    competition: result.competition,
    roundLabel: result.roundLabel,
    home: result.home,
    away: result.away,
    outcome: result.outcome,
    penaltyScore: result.penaltyScore,
    rows: statRows(raw, sportmonks),
    sportmonksMatched: sportmonks !== null,
    warnings: cardConflicts(raw, sportmonks),
  };
}
