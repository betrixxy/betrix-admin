import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import { getFixtureById } from "@/lib/services/api-football/fixtures";
import { getHeadToHead, getRecentFixtureDetails } from "@/lib/services/api-football/match-stats";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { DeepAnalysisStats, TeamDeepStats } from "@/types/deep-analysis";
import type { Result } from "@/types/result";
import type { TeamRef } from "@/types/sports";

async function getTeamDeepStats(team: TeamRef, beforeUtc: string): Promise<Result<TeamDeepStats, ApiFootballError>> {
  const details = await getRecentFixtureDetails(team, beforeUtc);
  if (!details.ok) return details;
  return { ok: true, data: computeTeamDeepStats(details.data, { id: Number(team.id), name: team.name, logoUrl: team.logoUrl }) };
}

/**
 * "AI Market Tahmin & Analiz" stüdyosunun gerçek verisi: iki takımın son 5 bitmiş maçından
 * form, gol/xG, topla oynama, pas isabeti, top kazanma, gol/KG/üst sayıları, diziliş ve
 * anahtar oyuncular + aralarındaki son maçlar. Yaklaşık 6 istek (Maç Günü'nün `getMatchStats`'ı
 * ile aynı önbellekli istekler — ikisi birlikte kullanıldığında kota iki kez harcanmaz).
 */
export async function getDeepAnalysisStats(apiFootballFixtureId: number): Promise<Result<DeepAnalysisStats, ApiFootballError>> {
  const fixtureResult = await getFixtureById(apiFootballFixtureId);
  if (!fixtureResult.ok) return fixtureResult;
  const fixture = fixtureResult.data;

  const [home, away, headToHead] = await Promise.all([
    getTeamDeepStats(fixture.homeTeam, fixture.kickoffUtc),
    getTeamDeepStats(fixture.awayTeam, fixture.kickoffUtc),
    getHeadToHead(Number(fixture.homeTeam.id), Number(fixture.awayTeam.id), fixture.kickoffUtc),
  ]);
  if (!home.ok) return home;
  if (!away.ok) return away;
  if (!headToHead.ok) return headToHead;

  return {
    ok: true,
    data: {
      fixture,
      home: home.data,
      away: away.data,
      headToHead: headToHead.data,
      source: "api-football",
      fetchedAtUtc: new Date().toISOString(),
    },
  };
}
