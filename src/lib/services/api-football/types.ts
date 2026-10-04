import { z } from "zod";

export const apiFootballFixtureStatusSchema = z.object({
  long: z.string(),
  short: z.string(),
  elapsed: z.number().nullable(),
});

export const apiFootballTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string(),
  winner: z.boolean().nullable(),
});

export const apiFootballLeagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string(),
  season: z.number(),
  round: z.string(),
  logo: z.string().optional(),
});

export const apiFootballFixtureRawSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    timestamp: z.number(),
    status: apiFootballFixtureStatusSchema,
    referee: z.string().nullable().optional(),
    venue: z
      .object({ name: z.string().nullable().optional(), city: z.string().nullable().optional() })
      .nullable()
      .optional(),
  }),
  league: apiFootballLeagueSchema,
  teams: z.object({
    home: apiFootballTeamSchema,
    away: apiFootballTeamSchema,
  }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
});

export type ApiFootballFixtureRaw = z.infer<typeof apiFootballFixtureRawSchema>;

/** `/fixtures/statistics` satırı — `value` sayı, "55%" gibi string ya da null olabilir. */
export const apiFootballStatisticSchema = z.object({
  type: z.string(),
  value: z.union([z.number(), z.string()]).nullable(),
});

export const apiFootballTeamStatisticsSchema = z.object({
  team: z.object({ id: z.number() }),
  statistics: z.array(apiFootballStatisticSchema),
});

/**
 * `/fixtures?ids=a-b-c` yanıtındaki ayrıntılı fikstür — temel alanlara ek olarak maç
 * istatistiklerini (xG dahil, `expected_goals`) içerir. Kapsam dışı liglerde boş gelir.
 */
export const apiFootballFixtureDetailRawSchema = apiFootballFixtureRawSchema.extend({
  statistics: z.array(apiFootballTeamStatisticsSchema).optional().default([]),
});

export type ApiFootballFixtureDetailRaw = z.infer<typeof apiFootballFixtureDetailRawSchema>;

function responseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    get: z.string(),
    results: z.number(),
    response: z.array(item),
  });
}

export const apiFootballFixturesResponseSchema = responseSchema(apiFootballFixtureRawSchema);
export const apiFootballFixtureDetailsResponseSchema = responseSchema(apiFootballFixtureDetailRawSchema);

export type ApiFootballFixturesResponse = z.infer<typeof apiFootballFixturesResponseSchema>;

/**
 * API-Football hataları HTTP 200 ile, gövdedeki `errors` alanında döndürür (ör. kota aşımı,
 * eksik parametre). Boşken `[]`, doluyken `{ alan: mesaj }` nesnesidir.
 */
export const apiFootballErrorsEnvelopeSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
});

export interface ApiFootballError {
  code: "NOT_CONFIGURED" | "TIMEOUT" | "NETWORK" | "HTTP_STATUS" | "INVALID_RESPONSE" | "API_ERROR" | "NOT_FOUND";
  message: string;
  status?: number;
}
