import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import { getFixtureById } from "@/lib/services/api-football/fixtures";
import { getHeadToHead, getRecentFixtureDetails } from "@/lib/services/api-football/match-stats";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import { getSportmonksAdvancedMetrics, isSportmonksConfigured } from "@/lib/services/sportmonks";
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
 * anahtar oyuncular, ileri metrikler (PPDA-tüm saha, kilit pas, şut kalitesi) + aralarındaki son
 * maçlar. API-Football: ~6 istek (Maç Günü'nün `getMatchStats`'ı ile aynı önbellekli istekler).
 * Sportmonks (anahtar varsa): büyük şans, tehlikeli atak, orta/uzun pas — ~4-6 istek, eşleşmezse
 * analiz onsuz devam eder.
 */
export async function getDeepAnalysisStats(apiFootballFixtureId: number): Promise<Result<DeepAnalysisStats, ApiFootballError>> {
  const fixtureResult = await getFixtureById(apiFootballFixtureId);
  if (!fixtureResult.ok) return fixtureResult;
  const fixture = fixtureResult.data;

  const sportmonksConfigured = isSportmonksConfigured();
  const [home, away, headToHead, sportmonks] = await Promise.all([
    getTeamDeepStats(fixture.homeTeam, fixture.kickoffUtc),
    getTeamDeepStats(fixture.awayTeam, fixture.kickoffUtc),
    getHeadToHead(Number(fixture.homeTeam.id), Number(fixture.awayTeam.id), fixture.kickoffUtc),
    sportmonksConfigured ? getSportmonksAdvancedMetrics(fixture) : Promise.resolve(null),
  ]);
  if (!home.ok) return home;
  if (!away.ok) return away;
  if (!headToHead.ok) return headToHead;

  return {
    ok: true,
    data: {
      fixture,
      home: { ...home.data, sportmonks: sportmonks?.home ?? null },
      away: { ...away.data, sportmonks: sportmonks?.away ?? null },
      headToHead: headToHead.data,
      source: "api-football",
      sportmonksStatus: !sportmonksConfigured ? "not-configured" : sportmonks?.matched ? "matched" : "unmatched",
      fetchedAtUtc: new Date().toISOString(),
    },
  };
}
