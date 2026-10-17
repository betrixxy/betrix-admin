import type { SportmonksFixture } from "@/lib/services/sportmonks/advanced-stats-mappers";
import type { StatRowKey } from "@/types/match-stats";

/**
 * Tek bitmiş maçın Sportmonks istatistikleri → satır değerleri (saf). Tip `developer_name` ile
 * okunur. Bir satır yalnızca iki tarafın değeri de geldiyse döner; birleşik satır (top çalma +
 * müdahale) iki bileşeni de gerektirir.
 */

export type SportmonksSidePair = { home: number; away: number };
export type SportmonksMatchValues = Partial<Record<StatRowKey, SportmonksSidePair>>;

const SINGLE: Partial<Record<StatRowKey, string>> = {
  possession: "BALL_POSSESSION",
  xg: "EXPECTED_GOALS",
  shotsTotal: "SHOTS_TOTAL",
  shotsOnTarget: "SHOTS_ON_TARGET",
  shotsOffTarget: "SHOTS_OFF_TARGET",
  shotsBlocked: "SHOTS_BLOCKED",
  shotsInsideBox: "SHOTS_INSIDEBOX",
  bigChancesMissed: "BIG_CHANCES_MISSED",
  dangerousAttacks: "DANGEROUS_ATTACKS",
  woodwork: "HIT_WOODWORK",
  corners: "CORNERS",
  offsides: "OFFSIDES",
  fouls: "FOULS",
  yellowCards: "YELLOWCARDS",
  redCards: "REDCARDS",
  saves: "SAVES",
  passes: "PASSES",
  passAccuracy: "SUCCESSFUL_PASSES_PERCENTAGE",
};

function value(fixture: SportmonksFixture, participantId: number, type: string): number | null {
  const raw = fixture.statistics.find((s) => s.participant_id === participantId && s.type?.developer_name === type)?.data?.value;
  if (raw === null || raw === undefined) return null;
  const numeric = typeof raw === "number" ? raw : Number.parseFloat(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function pair(fixture: SportmonksFixture, ids: { home: number; away: number }, types: string[]): SportmonksSidePair | null {
  const sum = (id: number) => {
    let total = 0;
    for (const type of types) {
      const v = value(fixture, id, type);
      if (v === null) return null;
      total += v;
    }
    return total;
  };
  const home = sum(ids.home);
  const away = sum(ids.away);
  return home === null || away === null ? null : { home, away };
}

export function sportmonksMatchValues(fixture: SportmonksFixture, ids: { home: number; away: number }): SportmonksMatchValues {
  const values: SportmonksMatchValues = {};
  for (const [key, type] of Object.entries(SINGLE) as [StatRowKey, string][]) {
    const found = pair(fixture, ids, [type]);
    if (found) values[key] = found;
  }
  const defensive = pair(fixture, ids, ["TACKLES", "INTERCEPTIONS"]);
  if (defensive) values.tacklesInterceptions = defensive;
  return values;
}
