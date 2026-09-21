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
});

export const apiFootballFixtureRawSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    timestamp: z.number(),
    status: apiFootballFixtureStatusSchema,
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

export const apiFootballFixturesResponseSchema = z.object({
  get: z.string(),
  results: z.number(),
  response: z.array(apiFootballFixtureRawSchema),
});

export type ApiFootballFixturesResponse = z.infer<typeof apiFootballFixturesResponseSchema>;

export interface ApiFootballError {
  code: "NOT_CONFIGURED" | "TIMEOUT" | "NETWORK" | "HTTP_STATUS" | "INVALID_RESPONSE";
  message: string;
  status?: number;
}
