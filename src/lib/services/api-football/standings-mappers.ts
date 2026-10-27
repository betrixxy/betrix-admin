import { cardTeamName } from "@/lib/archive/names";
import { z } from "zod";
import type { StandingRow, StandingsGroup, StandingZone } from "@/types/standings";

/**
 * API-Football `/standings` ham şeması ve kanonik tipe dönüşüm (saf). Sağlayıcı tabloyu
 * `league.standings: Satır[][]` olarak verir — her iç dizi bir grup (lig ise tek dizi).
 */

const goalsSchema = z.object({ for: z.number().nullable(), against: z.number().nullable() });
const recordSchema = z.object({ played: z.number().nullable(), win: z.number().nullable(), draw: z.number().nullable(), lose: z.number().nullable(), goals: goalsSchema });

export const standingsRowRawSchema = z.object({
  rank: z.number(),
  team: z.object({ id: z.number(), name: z.string(), logo: z.string() }),
  points: z.number().nullable(),
  goalsDiff: z.number().nullable(),
  group: z.string(),
  description: z.string().nullable(),
  all: recordSchema,
});
export type StandingsRowRaw = z.infer<typeof standingsRowRawSchema>;

export const standingsResponseRawSchema = z.object({
  response: z.array(z.object({ league: z.object({ logo: z.string(), standings: z.array(z.array(standingsRowRawSchema)) }) })),
});
export type StandingsResponseRaw = z.infer<typeof standingsResponseRawSchema>;

/**
 * Sıra çubuğunun rengi açıklamadan çıkarılır ("Promotion - Champions League (League phase)",
 * "Relegation - 1. Lig", "Promotion - Champions League (Play Offs: 1/16-finals)"). Play-off/eleme önce
 * bakılır: UCL lig aşamasında 9-24 de "Promotion - Champions League" ile başlar.
 */
export function standingZone(description: string | null): StandingZone {
  if (!description) return null;
  if (/relegation/i.test(description)) return "relegation";
  if (/play[\s-]?offs?|qualification/i.test(description)) return "playoff";
  if (/promotion|champions league|europa|conference|next round|knockout|round of/i.test(description)) return "top";
  return null;
}

export function toStandingRow(raw: StandingsRowRaw): StandingRow {
  const goalsFor = raw.all.goals.for ?? 0;
  const goalsAgainst = raw.all.goals.against ?? 0;
  return {
    rank: raw.rank,
    teamId: raw.team.id,
    teamName: cardTeamName(raw.team.name),
    logoUrl: raw.team.logo,
    played: raw.all.played ?? 0,
    win: raw.all.win ?? 0,
    draw: raw.all.draw ?? 0,
    lose: raw.all.lose ?? 0,
    goalsFor,
    goalsAgainst,
    goalDiff: raw.goalsDiff ?? goalsFor - goalsAgainst,
    points: raw.points ?? 0,
    zone: standingZone(raw.description),
  };
}

const GROUP_PATTERN = /^Group ([A-Z])$/;

/**
 * Tablolar → gruplar. Tek tablolu ligde bölüm başlığı boştur; "Group A" biçiminde gruplar "A GRUBU"
 * olur ve harf sırasıyla dizilir; diğer çoklu tablolar (konferans, play-off grupları) kendi adıyla kalır.
 */
export function toStandingsGroups(tables: StandingsRowRaw[][]): StandingsGroup[] {
  const nonEmpty = tables.filter((table) => table.length > 0);
  const groups = nonEmpty.map((table) => {
    const key = table[0]?.group ?? "";
    const letter = GROUP_PATTERN.exec(key)?.[1];
    const label = nonEmpty.length < 2 ? "" : letter ? `${letter} GRUBU` : key.toLocaleUpperCase("tr-TR");
    return { key, label, rows: table.map(toStandingRow).toSorted((a, b) => a.rank - b.rank) };
  });
  return groups.every((group) => GROUP_PATTERN.test(group.key)) ? groups.toSorted((a, b) => a.key.localeCompare(b.key)) : groups;
}
