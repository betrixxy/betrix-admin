import { z } from "zod";
import type { SportmonksAdvancedMetrics } from "@/types/deep-analysis";

/**
 * Sportmonks maç istatistiklerinden ileri metrikler + iki sağlayıcı arasında takım adı eşleme —
 * saf fonksiyonlar (bkz. CLAUDE.md 1.4, 5.2). İstatistikler `include=statistics.type` ile gelir;
 * tip `developer_name` ile okunur (type_id hesaba göre değişebileceği için kimliğe güvenilmez).
 */

const statSchema = z.object({
  participant_id: z.number(),
  type: z.object({ developer_name: z.string() }).nullish(),
  data: z.object({ value: z.union([z.number(), z.string()]).nullish() }).nullish(),
});

export const sportmonksFixtureSchema = z.object({
  id: z.number(),
  starting_at: z.string(),
  participants: z.array(z.object({ id: z.number(), name: z.string() })).optional().default([]).catch([]),
  statistics: z.array(statSchema).optional().default([]).catch([]),
});
export type SportmonksFixture = z.infer<typeof sportmonksFixtureSchema>;

export const sportmonksFixtureListSchema = z.object({ data: z.array(sportmonksFixtureSchema).optional().default([]) });
export const sportmonksTeamSearchSchema = z.object({
  data: z.array(z.object({ id: z.number(), name: z.string() })).optional().default([]),
});

/** Yaygın kulüp ekleri — "Kasımpaşa SK" ile "Kasimpasa" aynı takımdır. */
const CLUB_TOKENS = new Set(["fc", "sk", "ak", "as", "jk", "fk", "cf", "ac", "afc", "sc", "club", "spor", "kulubu"]);

/** Türkçe karakterleri ASCII'ye indirger, küçültür, kulüp eklerini ve noktalamayı atar. */
export function normalizeTeamName(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !CLUB_TOKENS.has(token))
    .join("");
}

export function isSameTeam(a: string, b: string): boolean {
  const [x, y] = [normalizeTeamName(a), normalizeTeamName(b)];
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** API arama ucu için sade ad — "Kasımpaşa" → "Kasimpasa". */
export function searchableTeamName(name: string): string {
  return name.replace(/ı/g, "i").replace(/İ/g, "I").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function statValue(fixture: SportmonksFixture, participantId: number, type: string): number | null {
  const value = fixture.statistics.find((s) => s.participant_id === participantId && s.type?.developer_name === type)?.data?.value;
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function ratio(num: number, den: number): number | null {
  return den > 0 ? (num / den) * 100 : null;
}

/** Takımın (Sportmonks kimliği) bitmiş maçlarından ileri metrik ortalamaları. */
export function computeSportmonksMetrics(fixtures: SportmonksFixture[], teamId: number): SportmonksAdvancedMetrics {
  const created: number[] = [];
  const missed: number[] = [];
  const conceded: number[] = [];
  const dangerous: number[] = [];
  const crosses = { total: 0, accurate: 0 };
  const longPasses = { total: 0, successful: 0 };

  for (const fixture of fixtures) {
    const opponent = fixture.participants.find((p) => p.id !== teamId);
    const push = (list: number[], value: number | null) => value !== null && list.push(value);
    push(created, statValue(fixture, teamId, "BIG_CHANCES_CREATED"));
    push(missed, statValue(fixture, teamId, "BIG_CHANCES_MISSED"));
    if (opponent) push(conceded, statValue(fixture, opponent.id, "BIG_CHANCES_CREATED"));
    push(dangerous, statValue(fixture, teamId, "DANGEROUS_ATTACKS"));

    const totalCrosses = statValue(fixture, teamId, "TOTAL_CROSSES");
    const accurateCrosses = statValue(fixture, teamId, "ACCURATE_CROSSES");
    if (totalCrosses !== null && accurateCrosses !== null) {
      crosses.total += totalCrosses;
      crosses.accurate += accurateCrosses;
    }
    const totalLong = statValue(fixture, teamId, "LONG_PASSES");
    const successfulLong = statValue(fixture, teamId, "SUCCESSFUL_LONG_PASSES");
    if (totalLong !== null && successfulLong !== null) {
      longPasses.total += totalLong;
      longPasses.successful += successfulLong;
    }
  }

  return {
    matchesSampled: fixtures.length,
    bigChancesCreatedAvg: average(created),
    bigChancesMissedAvg: average(missed),
    bigChancesConcededAvg: average(conceded),
    dangerousAttacksAvg: average(dangerous),
    crossAccuracyPct: ratio(crosses.accurate, crosses.total),
    longPassAccuracyPct: ratio(longPasses.successful, longPasses.total),
  };
}
