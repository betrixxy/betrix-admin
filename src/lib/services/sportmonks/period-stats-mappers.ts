import { z } from "zod";
import { HALF_STAT_KEYS, type HalfRow, type HalfStatKey } from "@/types/match-analysis";

/**
 * Sportmonks dönem istatistiği (`/fixtures/{id}?include=periods.statistics.type`) — ham şema + 02 satırları
 * (saf). Dönem `type_id` 1 = ilk yarı, 2 = ikinci yarı (`description` "1st-half"/"2nd-half"); uzatma
 * dönemleri okunmaz. Tip `developer_name` ile okunur (kimlik hesaba göre değişebilir). Satır yalnızca iki
 * yarıda iki takımın değeri de geldiyse döner — eksik satır düşer, 0 yazılmaz.
 */

const periodStatSchema = z.object({
  participant_id: z.number(),
  type: z.object({ developer_name: z.string() }).nullish(),
  data: z.object({ value: z.union([z.number(), z.string()]).nullish() }).nullish(),
});

export const sportmonksPeriodSchema = z.object({
  type_id: z.number().nullish(),
  description: z.string().nullish(),
  statistics: z.array(periodStatSchema).optional().default([]).catch([]),
});

export const sportmonksPeriodFixtureResponseSchema = z.object({
  data: z.object({ id: z.number(), periods: z.array(sportmonksPeriodSchema).optional().default([]).catch([]) }),
});

export type SportmonksPeriodRaw = z.infer<typeof sportmonksPeriodSchema>;

const TYPES: Record<HalfStatKey, string> = {
  possession: "BALL_POSSESSION",
  shotsTotal: "SHOTS_TOTAL",
  shotsOnTarget: "SHOTS_ON_TARGET",
  xg: "EXPECTED_GOALS",
  corners: "CORNERS",
};

const FIRST_HALF = 1;
const SECOND_HALF = 2;

function periodOf(periods: readonly SportmonksPeriodRaw[], typeId: number, description: string): SportmonksPeriodRaw | null {
  return periods.find((period) => period.type_id === typeId) ?? periods.find((period) => period.description === description) ?? null;
}

function value(period: SportmonksPeriodRaw | null, participantId: number, type: string): number | null {
  const raw = period?.statistics.find((stat) => stat.participant_id === participantId && stat.type?.developer_name === type)?.data?.value;
  if (raw === null || raw === undefined) return null;
  const numeric = typeof raw === "number" ? raw : Number.parseFloat(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

/** `ids`: maçın Sportmonks katılımcı kimlikleri (ev sahibi / deplasman). */
export function sportmonksHalfRows(periods: readonly SportmonksPeriodRaw[], ids: { home: number; away: number }): HalfRow[] {
  const first = periodOf(periods, FIRST_HALF, "1st-half");
  const second = periodOf(periods, SECOND_HALF, "2nd-half");
  if (!first || !second) return [];
  const rows: HalfRow[] = [];
  for (const key of HALF_STAT_KEYS) {
    const type = TYPES[key];
    const [h1, a1, h2, a2] = [value(first, ids.home, type), value(first, ids.away, type), value(second, ids.home, type), value(second, ids.away, type)];
    if (h1 === null || a1 === null || h2 === null || a2 === null) continue;
    rows.push({ key, first: { home: h1, away: a1 }, second: { home: h2, away: a2 } });
  }
  return rows;
}
