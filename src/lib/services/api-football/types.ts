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
  /** Yalnızca penaltı atışları okunur; blok bozuk/eksikse yok sayılır. */
  score: z
    .object({ penalty: z.object({ home: z.number().nullable(), away: z.number().nullable() }).nullish() })
    .nullish()
    .catch(null),
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

const nullableNumber = z.number().nullish();

/** Maç içi sayı alanı: sayı ya da sayısal metin (`passes.accuracy` = isabetli pas SAYISI, "23"); eşleyici sayıya çevirir. */
const countField = z.union([z.number(), z.string()]).nullish();

/** `/fixtures?ids=` içindeki oyuncu satırı — yalnızca kullanılan alanlar; hepsi boş gelebilir. */
export const apiFootballPlayerStatisticsSchema = z.object({
  games: z.object({ minutes: nullableNumber, position: z.string().nullish(), rating: z.string().nullish(), substitute: z.boolean().nullish() }).nullish(),
  shots: z.object({ total: nullableNumber, on: nullableNumber }).nullish().catch(null),
  goals: z.object({ total: nullableNumber, assists: nullableNumber, conceded: nullableNumber, saves: nullableNumber }).nullish(),
  passes: z.object({ key: nullableNumber, total: nullableNumber, accuracy: countField }).nullish(),
  tackles: z.object({ total: nullableNumber, interceptions: nullableNumber, blocks: nullableNumber }).nullish(),
  duels: z.object({ total: nullableNumber, won: nullableNumber }).nullish(),
  dribbles: z.object({ attempts: nullableNumber, success: nullableNumber }).nullish(),
  fouls: z.object({ drawn: nullableNumber }).nullish().catch(null),
  penalty: z.object({ saved: nullableNumber }).nullish().catch(null),
});

export const apiFootballTeamPlayersSchema = z.object({
  team: z.object({ id: z.number() }),
  players: z.array(
    z.object({
      player: z.object({ id: z.number(), name: z.string(), photo: z.string().nullish() }),
      statistics: z.array(apiFootballPlayerStatisticsSchema),
    }),
  ),
});

/** Diziliş + ilk 11 — Muhtemel 11 stüdyosu için (bkz. lineups.ts). Eksik alanlar boş sayılır. */
export const apiFootballLineupSchema = z.object({
  team: z.object({
    id: z.number(),
    colors: z
      .object({ player: z.object({ primary: z.string().nullish() }).nullish() })
      .nullish()
      .catch(null),
  }),
  formation: z.string().nullish(),
  coach: z.object({ name: z.string().nullish() }).nullish().catch(null),
  startXI: z
    .array(z.object({ player: z.object({ id: z.number().nullish(), name: z.string(), number: z.number().nullish(), grid: z.string().nullish() }) }))
    .nullish()
    .catch(null),
});

export type ApiFootballLineupRaw = z.infer<typeof apiFootballLineupSchema>;

/** `/players/squads?team=` — güncel kadro (pozisyon + forma numarası). */
export const apiFootballSquadsResponseSchema = z.object({
  response: z.array(
    z.object({
      team: z.object({ id: z.number() }),
      players: z.array(
        z.object({ id: z.number(), name: z.string().nullable(), number: z.number().nullish(), position: z.string().nullish() }),
      ),
    }),
  ),
});

export type ApiFootballSquadRaw = z.infer<typeof apiFootballSquadsResponseSchema>["response"][number];

/**
 * `/fixtures?ids=a-b-c` yanıtındaki ayrıntılı fikstür — temel alanlara ek olarak maç
 * istatistiklerini (xG dahil, `expected_goals`), oyuncu istatistiklerini ve dizilişi içerir.
 * Kapsam dışı liglerde boş gelir. Oyuncu/diziliş blokları bozuk gelirse boş sayılır: derin
 * analiz verisi eksik kalır ama form/xG kullanan mevcut akışlar asla bu yüzden düşmez.
 */
export const apiFootballFixtureDetailRawSchema = apiFootballFixtureRawSchema.extend({
  statistics: z.array(apiFootballTeamStatisticsSchema).optional().default([]),
  players: z.array(apiFootballTeamPlayersSchema).optional().default([]).catch([]),
  lineups: z.array(apiFootballLineupSchema).optional().default([]).catch([]),
});

export type ApiFootballFixtureDetailRaw = z.infer<typeof apiFootballFixtureDetailRawSchema>;

/** `/fixtures?id=` olay akışı — Maç Sonucu golcü listesi yalnızca `type: "Goal"` satırlarını okur. */
export const apiFootballEventSchema = z.object({
  time: z.object({ elapsed: z.number().nullable(), extra: z.number().nullish() }),
  team: z.object({ id: z.number() }),
  player: z.object({ id: z.number().nullish(), name: z.string().nullish() }),
  type: z.string(),
  detail: z.string().nullish(),
  comments: z.string().nullish(),
});

export type ApiFootballEventRaw = z.infer<typeof apiFootballEventSchema>;

/** Bitmiş maç: ayrıntılı fikstür + olaylar. Bozuk olay bloğu boş sayılır. */
export const apiFootballFixtureResultRawSchema = apiFootballFixtureDetailRawSchema.extend({
  events: z.array(apiFootballEventSchema).optional().default([]).catch([]),
});

export type ApiFootballFixtureResultRaw = z.infer<typeof apiFootballFixtureResultRawSchema>;

function responseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    get: z.string(),
    results: z.number(),
    response: z.array(item),
  });
}

export const apiFootballFixturesResponseSchema = responseSchema(apiFootballFixtureRawSchema);
export const apiFootballFixtureDetailsResponseSchema = responseSchema(apiFootballFixtureDetailRawSchema);
export const apiFootballFixtureResultsResponseSchema = responseSchema(apiFootballFixtureResultRawSchema);

export type ApiFootballFixturesResponse = z.infer<typeof apiFootballFixturesResponseSchema>;

/* ---------- Lig / takım / kadro (bkz. squads.ts — medya havuzu) ---------- */

export const apiFootballLeagueSeasonsRawSchema = z.object({
  // `type`: "League" | "Cup" — arşiv takımın yurt içi ligini bununla seçer.
  league: z.object({ id: z.number(), name: z.string(), type: z.string().optional(), logo: z.string().nullish() }),
  country: z.object({ name: z.string().nullable() }),
  seasons: z.array(z.object({ year: z.number(), current: z.boolean(), start: z.string().nullish(), end: z.string().nullish() })),
});

export const apiFootballTeamInfoRawSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string().nullable(),
    national: z.boolean().nullable().optional(),
    logo: z.string().nullish(),
  }),
});

export const apiFootballPlayerProfileRawSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  birth: z.object({ date: z.string().nullable() }).nullable().optional(),
});

export const apiFootballSeasonPlayerRawSchema = z.object({ player: apiFootballPlayerProfileRawSchema });

export type ApiFootballPlayerProfileRaw = z.infer<typeof apiFootballPlayerProfileRawSchema>;

/** `/coachs?team=` — teknik direktör ve kariyeri (güncel takımı: `end = null`). */
export const apiFootballCoachRawSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  nationality: z.string().nullish(),
  career: z.array(z.object({ team: z.object({ id: z.number(), name: z.string().nullish() }), start: z.string().nullable(), end: z.string().nullable() })).default([]),
});

export type ApiFootballCoachRaw = z.infer<typeof apiFootballCoachRawSchema>;

export const apiFootballLeagueSeasonsResponseSchema = responseSchema(apiFootballLeagueSeasonsRawSchema);
export const apiFootballCoachsResponseSchema = responseSchema(apiFootballCoachRawSchema);
export const apiFootballTeamsResponseSchema = responseSchema(apiFootballTeamInfoRawSchema);
export const apiFootballProfilesResponseSchema = responseSchema(apiFootballSeasonPlayerRawSchema);
export const apiFootballSeasonPlayersResponseSchema = responseSchema(apiFootballSeasonPlayerRawSchema).extend({
  paging: z.object({ current: z.number(), total: z.number() }),
});

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
