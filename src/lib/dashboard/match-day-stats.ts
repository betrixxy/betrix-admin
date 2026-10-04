import { getMatchStats, parseFixtureId } from "@/lib/services/api-football";
import type { MatchDayStats } from "@/types/match-day";
import type { MatchStats } from "@/types/sports";

/** API-Football maç istatistiğinden "Data Driven" şablonunun ihtiyaç duyduğu özet. Saf fonksiyon. */
export function toMatchDayStats(stats: MatchStats): MatchDayStats {
  const { home, away, headToHead } = stats;
  return {
    homeForm: home.last5,
    awayForm: away.last5,
    homeGoalsForAvg: home.goalsForAvg,
    awayGoalsForAvg: away.goalsForAvg,
    homeGoalsAgainstAvg: home.goalsAgainstAvg,
    awayGoalsAgainstAvg: away.goalsAgainstAvg,
    h2h: {
      played: headToHead.matches.length,
      homeWins: headToHead.homeWins,
      draws: headToHead.draws,
      awayWins: headToHead.awayWins,
    },
  };
}

/**
 * Seçili maçın gerçek verisi. Elle doldurulan kartta, sağlayıcı hatasında ya da veri boşsa
 * `null` döner — şablon künye kutularına düşer; kart üretimi bu yüzden asla durmaz.
 */
export async function loadMatchDayStats(fixtureId: string | null): Promise<MatchDayStats | null> {
  const apiId = fixtureId ? parseFixtureId(fixtureId) : null;
  if (apiId === null) return null;
  const result = await getMatchStats(apiId);
  if (!result.ok) {
    console.error(`[match-day] ${fixtureId} istatistikleri alınamadı: ${result.error.code} ${result.error.message}`);
    return null;
  }
  const stats = toMatchDayStats(result.data);
  return stats.homeForm.length || stats.awayForm.length || stats.h2h.played ? stats : null;
}
