import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_STAT_SELECTION } from "@/lib/dashboard/studio-stats";
import type { DraftRenderOptions } from "@/types/draft";
import type { MatchStats } from "@/types/sports";

/**
 * `AiContent.statsSnapshot` / `renderOptions` JSON sütunları veritabanından `unknown` olarak
 * gelir; bu şemalar onları kanonik tiplere daraltır (bkz. CLAUDE.md 1.3.2). Şemalar
 * `types/sports.ts` ve `types/draft.ts` ile birebir tutulmalıdır.
 */

const resultLetter = z.enum(["W", "D", "L"]);
const derbyIntensity = z.enum(["NONE", "RIVALRY", "DERBY", "ELITE_DERBY"]);

const teamRef = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  primaryColorHex: z.string(),
  logoUrl: z.string(),
});

const fixture = z.object({
  id: z.string(),
  providerIds: z.object({ sportmonks: z.number().optional(), apiFootball: z.number().optional() }),
  kickoffUtc: z.string(),
  status: z.enum(["SCHEDULED", "LIVE", "HT", "FT", "POSTPONED", "CANCELLED"]),
  homeTeam: teamRef,
  awayTeam: teamRef,
  competition: z.object({ id: z.string(), name: z.string(), shortName: z.string() }),
  derbyIntensity,
});

const recentForm = z.object({
  teamId: z.string(),
  teamName: z.string(),
  logoUrl: z.string(),
  last5: z.array(resultLetter),
  matchesSampled: z.number(),
  goalsForAvg: z.number().nullable(),
  goalsAgainstAvg: z.number().nullable(),
  xgForAvg: z.number().nullable(),
  xgAgainstAvg: z.number().nullable(),
  xgMatchesSampled: z.number(),
});

const matchStatsSchema = z.object({
  fixture,
  home: recentForm,
  away: recentForm,
  headToHead: z.object({
    matches: z.array(
      z.object({
        kickoffUtc: z.string(),
        homeTeamName: z.string(),
        awayTeamName: z.string(),
        homeGoals: z.number(),
        awayGoals: z.number(),
      }),
    ),
    homeWins: z.number(),
    draws: z.number(),
    awayWins: z.number(),
  }),
  source: z.literal("api-football"),
  fetchedAtUtc: z.string(),
});

const renderOptionsSchema = z.object({
  selection: z.object({
    includeForm: z.boolean(),
    includeGoals: z.boolean(),
    includeXg: z.boolean(),
    includeHeadToHead: z.boolean(),
  }),
  derbyIntensity,
});

export const DEFAULT_RENDER_OPTIONS: DraftRenderOptions = {
  selection: DEFAULT_STAT_SELECTION,
  derbyIntensity: "NONE",
};

/** Snapshot'ı olmayan (eski/stüdyo-dışı) kayıtlarda null — inceleme ekranı bunu ayrıca gösterir. */
export function parseStatsSnapshot(value: unknown): MatchStats | null {
  const parsed = matchStatsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseRenderOptions(value: unknown): DraftRenderOptions {
  const parsed = renderOptionsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_RENDER_OPTIONS;
}

/** Kanonik tipi Prisma `Json` sütununa yazılabilir düz JSON'a çevirir (undefined alanlar atılır). */
export function toJsonValue(value: MatchStats | DraftRenderOptions): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export { derbyIntensity as derbyIntensitySchema };
