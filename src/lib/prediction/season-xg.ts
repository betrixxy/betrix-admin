import type { DeepAnalysisStats, TeamDeepStats } from "@/types/deep-analysis";
import type { TeamRecentForm } from "@/types/sports";

/**
 * Sezon lig xG'si — modelin (Poisson) ve gerekçenin ORTAK xG kaynağı (kurucu kararı, 2026-10-27):
 * bu sezonun yurt içi lig maçları, en az SEASON_XG_MIN_MATCHES xG'li maç; azsa xG yok, yalnızca gol.
 * Gol ve form girdisi son 5 maç (tüm kulvarlar) olarak kalır. Saf.
 */

export const SEASON_XG_MIN_MATCHES = 5;

/** Takımın sezon lig xG'si kullanılabilir mi (lig biliniyor + yeterli örneklem). */
export function usableSeasonXg(team: TeamDeepStats): boolean {
  return team.seasonLeagueXg !== null && team.seasonLeagueXg.matchesSampled >= SEASON_XG_MIN_MATCHES;
}

/** Modelin girdisi: son 5 maçın formu/golü + xG yalnızca sezon liginden (yoksa null → yalnızca gol). */
export function modelForm(team: TeamDeepStats): TeamRecentForm {
  const season = usableSeasonXg(team) ? team.seasonLeagueXg : null;
  return { ...team.form, xgForAvg: season?.xgForAvg ?? null, xgAgainstAvg: season?.xgAgainstAvg ?? null };
}

/**
 * İki takımın yurt içi ligi farklı mı (Avrupa kupaları vb.). Ligi bilinmeyen takım varsa false —
 * o takımın xG'si zaten kullanılmaz. Farklı liglerde xG doğrudan karşılaştırılamaz: model yine
 * çalışır, stüdyo uyarır, gerekçe iki takımın xG'sini kıyaslayamaz.
 */
export function differentLeagues(stats: Pick<DeepAnalysisStats, "home" | "away">): boolean {
  const home = stats.home.seasonLeagueXg;
  const away = stats.away.seasonLeagueXg;
  return home !== null && away !== null && home.leagueId !== away.leagueId;
}

export const DIFFERENT_LEAGUES_WARNING = "Farklı ligler: xG doğrudan karşılaştırılamaz";
