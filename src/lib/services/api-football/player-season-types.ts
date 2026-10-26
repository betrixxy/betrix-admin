import { z } from "zod";

/**
 * API-Football `/players?id=&season=` — oyuncunun sezon istatistikleri, takım × turnuva başına bir
 * kayıt. Ham şema (bkz. CLAUDE.md 1.3): alanlar sık sık `null` gelir — null "bilinmiyor"dur, 0 değil.
 */

const count = z.number().nullish();

export const apiFootballPlayerSeasonEntrySchema = z.object({
  team: z.object({ id: z.number(), name: z.string(), logo: z.string().nullish() }),
  league: z.object({ id: z.number(), name: z.string(), country: z.string().nullish(), season: z.number().nullish() }),
  games: z.object({ appearences: count, minutes: count, position: z.string().nullish(), rating: z.union([z.string(), z.number()]).nullish() }),
  shots: z.object({ total: count, on: count }).partial().nullish(),
  goals: z.object({ total: count, assists: count, saves: count }).partial().nullish(),
  passes: z.object({ total: count, key: count, accuracy: z.union([z.number(), z.string()]).nullish() }).partial().nullish(),
  tackles: z.object({ total: count, interceptions: count }).partial().nullish(),
  duels: z.object({ total: count, won: count }).partial().nullish(),
  dribbles: z.object({ attempts: count, success: count }).partial().nullish(),
  penalty: z.object({ scored: count }).partial().nullish(),
});
export type ApiFootballPlayerSeasonEntry = z.infer<typeof apiFootballPlayerSeasonEntrySchema>;

export const apiFootballPlayerSeasonSchema = z.object({
  player: z.object({
    id: z.number(),
    name: z.string(),
    firstname: z.string().nullish(),
    lastname: z.string().nullish(),
    nationality: z.string().nullish(),
    photo: z.string().nullish(),
  }),
  statistics: z.array(apiFootballPlayerSeasonEntrySchema),
});
export type ApiFootballPlayerSeason = z.infer<typeof apiFootballPlayerSeasonSchema>;

export const apiFootballPlayerSeasonResponseSchema = z.object({ response: z.array(apiFootballPlayerSeasonSchema) });
