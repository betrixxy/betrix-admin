import { z } from "zod";
import { competitionKind, competitionName, resultRoundLabel } from "@/lib/dashboard/match-result-labels";
import { cardTeamName } from "@/lib/archive/names";
import { originFromCountry } from "@/lib/dashboard/name-case";
import { apiFootballFixtureRawSchema } from "@/lib/services/api-football/types";
import type { Goals, ScorecardMatch } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi'nin maç skoru — `/fixtures?id=` (tek istek, yalnızca okuma). API-Football skor blokları:
 * `score.halftime` (ilk yarı), `score.fulltime` (NORMAL SÜRE sonu, 90 dk + uzatma dakikaları), `score.extratime`
 * (yalnızca uzatmada atılan goller), `score.penalty` (atışlar); `goals` = normal süre + uzatma. Karne normal süre
 * skorunu okur (`settle.ts`). FT'de `fulltime` boşsa `goals` aynı skordur; AET/PEN'de `goals` uzatmayı içerdiği
 * için yedek olarak kullanılmaz.
 */

const pairSchema = z.object({ home: z.number().nullable(), away: z.number().nullable() });
const scoreRawSchema = apiFootballFixtureRawSchema.extend({
  score: z.object({ halftime: pairSchema.nullish(), fulltime: pairSchema.nullish(), extratime: pairSchema.nullish(), penalty: pairSchema.nullish() }).nullish().catch(null),
});
export const scoreResponseSchema = z.object({ response: z.array(scoreRawSchema) });

export type ApiFootballScoreRaw = z.infer<typeof scoreRawSchema>;

const goals = (pair: z.infer<typeof pairSchema> | null | undefined): Goals | null => (pair && pair.home !== null && pair.away !== null ? { home: pair.home, away: pair.away } : null);

/** Saf: ham fikstür → karnenin maç alanları (kart takım adı, lig kart adı, tur, skor). */
export function toScorecardMatch(raw: ApiFootballScoreRaw): ScorecardMatch {
  const statusShort = raw.fixture.status.short;
  const fulltime = goals(raw.score?.fulltime) ?? (statusShort === "FT" ? goals(raw.goals) : null);
  // Yurt içi ligde iki takımın kökeni ligin ülkesinden; kupada bilinmiyor (motor `withTeamOrigins` ile doldurur).
  const origin = raw.league.country === "World" ? undefined : { name: originFromCountry(raw.league.country), people: originFromCountry(raw.league.country) };
  const team = (side: "home" | "away") => ({ id: raw.teams[side].id, name: cardTeamName(raw.teams[side].name), logoUrl: raw.teams[side].logo, ...(origin ? { origin } : {}) });
  return {
    fixtureId: `api-football-${raw.fixture.id}`,
    kickoffUtc: new Date(raw.fixture.date).toISOString(),
    competition: { id: raw.league.id, name: competitionName(raw.league.id, competitionKind(raw.league.id), raw.league.name) },
    roundLabel: resultRoundLabel(raw.league.round),
    home: team("home"),
    away: team("away"),
    score: { statusShort, fulltime, halftime: goals(raw.score?.halftime) },
  };
}
