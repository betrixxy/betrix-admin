import { z } from "zod";
import { isSameTeam } from "@/lib/services/sportmonks/advanced-stats-mappers";
import type { H2HStatKey } from "@/types/player-h2h";

/**
 * Sportmonks oyuncu sezon istatistikleri (`/players/{id}?include=statistics.details.type;
 * statistics.season.league;statistics.team`) — saf. İki sağlayıcı arasında kimlik tablosu yok: kayıt
 * sezon adı ("2026/2027"), takım adı ve (lig kapsamında) lig adıyla seçilir. Tipler `developer_name`
 * ile okunur. Değerler TOPLAM; yüzde ve puan ağırlıklı.
 */

const detailSchema = z.object({
  type: z.object({ developer_name: z.string() }).nullish(),
  value: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).nullish(),
});

export const sportmonksPlayerStatSchema = z.object({
  season: z.object({ name: z.string(), league: z.object({ name: z.string() }).nullish() }).nullish(),
  team: z.object({ name: z.string() }).nullish(),
  details: z.array(detailSchema).optional().default([]).catch([]),
});
export type SportmonksPlayerStat = z.infer<typeof sportmonksPlayerStatSchema>;

export const sportmonksPlayerSchema = z.object({
  data: z.object({ id: z.number(), display_name: z.string().nullish(), name: z.string().nullish(), statistics: z.array(sportmonksPlayerStatSchema).optional().default([]) }),
});

export const sportmonksPlayerSearchSchema = z.object({
  data: z.array(z.object({ id: z.number(), display_name: z.string().nullish(), name: z.string().nullish() })).optional().default([]),
});

/** Aksansız, küçük, harf dışı atılmış ad ("Dušan Vlahović" → "dusanvlahovic"). */
export function normalizeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

/** Aday adı oyuncunun adıyla tutuyor mu: soyadı geçmeli, ilk adın baş harfi (varsa) aynı olmalı. */
export function nameMatches(candidate: string, fullName: string, surname: string): boolean {
  const normalized = normalizeName(candidate);
  if (!normalized.includes(normalizeName(surname))) return false;
  const first = normalizeName(fullName.split(/\s+/)[0] ?? "");
  const candidateFirst = normalizeName(candidate.split(/\s+/)[0] ?? "");
  return !first || !candidateFirst || first[0] === candidateFirst[0];
}

/** "2026" → "2026/2027" (Sportmonks sezon adı). */
export const sportmonksSeasonName = (season: number) => `${season}/${season + 1}`;

/** Lig adları eşleşiyor mu ("Süper Lig" ↔ "Super Lig", "UEFA Europa League" ↔ "Europa League"). */
export function isSameLeague(a: string, b: string): boolean {
  const [x, y] = [normalizeName(a).replace(/^uefa/, ""), normalizeName(b).replace(/^uefa/, "")];
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

export interface SportmonksScope {
  season: number;
  teamName: string;
  /** Lig kapsamında ligin adı; tüm turnuvalarda null. */
  leagueName: string | null;
}

export function scopedRecords(stats: SportmonksPlayerStat[], scope: SportmonksScope): SportmonksPlayerStat[] {
  const seasonName = sportmonksSeasonName(scope.season);
  return stats.filter(
    (stat) =>
      stat.season?.name === seasonName &&
      !!stat.team?.name &&
      isSameTeam(stat.team.name, scope.teamName) &&
      (scope.leagueName === null || isSameLeague(stat.season.league?.name ?? "", scope.leagueName)) &&
      stat.details.length > 0,
  );
}

const read = (stat: SportmonksPlayerStat, type: string, field = "total"): number | null => {
  const value = stat.details.find((detail) => detail.type?.developer_name === type)?.value?.[field];
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function sum(stats: SportmonksPlayerStat[], type: string, field = "total"): number | undefined {
  let total = 0;
  for (const stat of stats) {
    const value = read(stat, type, field);
    if (value === null) return undefined;
    total += value;
  }
  return stats.length ? total : undefined;
}

function weighted(stats: SportmonksPlayerStat[], type: string, field: string, weightType: string): number | undefined {
  let total = 0;
  let weights = 0;
  for (const stat of stats) {
    const [value, weight] = [read(stat, type, field), read(stat, weightType)];
    if (value === null || weight === null) return undefined;
    total += value * weight;
    weights += weight;
  }
  return weights > 0 ? total / weights : undefined;
}

export interface SportmonksSeasonValues {
  minutes: number | undefined;
  appearances: number | undefined;
  values: Partial<Record<H2HStatKey, number>>;
  penaltyGoals: number | undefined;
}

/** Kapsamdaki kayıtların toplamı. xA tipi Sportmonks'ta yok (2026-10 planı) — hiç dolmaz. */
export function sportmonksSeasonValues(stats: SportmonksPlayerStat[]): SportmonksSeasonValues {
  const values: Partial<Record<H2HStatKey, number>> = {};
  const set = (key: H2HStatKey, value: number | undefined) => {
    if (value !== undefined) values[key] = value;
  };
  set("goals", sum(stats, "GOALS"));
  set("assists", sum(stats, "ASSISTS"));
  set("xg", sum(stats, "EXPECTED_GOALS", "expected"));
  set("shots", sum(stats, "SHOTS_TOTAL"));
  set("shotsOnTarget", sum(stats, "SHOTS_ON_TARGET"));
  set("bigChancesCreated", sum(stats, "BIG_CHANCES_CREATED"));
  set("keyPasses", sum(stats, "KEY_PASSES"));
  set("dribbles", sum(stats, "SUCCESSFUL_DRIBBLES"));
  set("interceptions", sum(stats, "INTERCEPTIONS"));
  set("tackles", sum(stats, "TACKLES"));
  set("saves", sum(stats, "SAVES"));
  set("passAccuracy", weighted(stats, "ACCURATE_PASSES_PERCENTAGE", "total", "PASSES"));
  set("rating", weighted(stats, "RATING", "average", "APPEARANCES"));
  const [duels, won] = [sum(stats, "TOTAL_DUELS"), sum(stats, "DUELS_WON")];
  if (duels !== undefined && won !== undefined && duels > 0) values.duelsWonPct = (won / duels) * 100;
  return { minutes: sum(stats, "MINUTES_PLAYED"), appearances: sum(stats, "APPEARANCES"), values, penaltyGoals: sum(stats, "PENALTIES", "scored") };
}
