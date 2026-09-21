import { z } from "zod";

/**
 * NOT: Sportmonks v3 `statistics.details` alanı `type_id` + `value` çiftleriyle çalışır;
 * hangi `type_id`'nin hangi metriğe (xG, tehlikeli atak vb.) karşılık geldiği hesaba göre
 * değişir. Bu şema kabul edilen zarfı (envelope) doğrular; metrik eşlemesi (bkz.
 * `SPORTMONKS_STAT_TYPE_IDS` in mappers.ts) gerçek bir yanıt yakalanıp hesabın "type
 * reference" tablosuyla doğrulanmadan production'a alınmamalıdır.
 */

export const sportmonksScoreSchema = z.object({
  description: z.string(),
  score: z.object({
    goals: z.number(),
    participant: z.enum(["home", "away"]),
  }),
});

export const sportmonksParticipantSchema = z.object({
  id: z.number(),
  name: z.string(),
  meta: z.object({ location: z.enum(["home", "away"]) }).nullable().optional(),
});

export const sportmonksFixtureSummarySchema = z.object({
  id: z.number(),
  starting_at: z.string(),
  participants: z.array(sportmonksParticipantSchema).optional(),
  scores: z.array(sportmonksScoreSchema).optional(),
});

export type SportmonksFixtureSummary = z.infer<typeof sportmonksFixtureSummarySchema>;

export const sportmonksStatDetailSchema = z.object({
  type_id: z.number(),
  value: z.unknown(),
});

export const sportmonksTeamStatisticsSchema = z.object({
  season_id: z.number(),
  details: z.array(sportmonksStatDetailSchema),
});

export const sportmonksTeamRawSchema = z.object({
  id: z.number(),
  name: z.string(),
  short_code: z.string().nullable().optional(),
  latest: z.array(sportmonksFixtureSummarySchema).optional(),
  statistics: z.array(sportmonksTeamStatisticsSchema).optional(),
});

export type SportmonksTeamRaw = z.infer<typeof sportmonksTeamRawSchema>;

export const sportmonksTeamResponseSchema = z.object({
  data: sportmonksTeamRawSchema,
});

export interface SportmonksError {
  code: "NOT_CONFIGURED" | "TIMEOUT" | "NETWORK" | "HTTP_STATUS" | "INVALID_RESPONSE";
  message: string;
  status?: number;
}
