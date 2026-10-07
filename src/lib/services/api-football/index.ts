export { isApiFootballConfigured } from "@/lib/services/api-football/client";
export {
  MAX_RANGE_DAYS,
  getFixtureById,
  getFixturesByIds,
  getFixturesForDateRange,
  getUpcomingFixtures,
} from "@/lib/services/api-football/fixtures";
export type { FixtureDateRange } from "@/lib/services/api-football/fixtures";
export { getHeadToHead, getMatchStats, getTeamRecentForm } from "@/lib/services/api-football/match-stats";
export { getDeepAnalysisStats } from "@/lib/services/api-football/deep-analysis";
export { getLineupReference } from "@/lib/services/api-football/lineups";
export { parseFixtureId, toFixtureId } from "@/lib/services/api-football/mappers";
export type { ApiFootballError } from "@/lib/services/api-football/types";
export {
  SUPPORTED_LEAGUES,
  SUPPORTED_LEAGUE_IDS,
  isSupportedLeagueId,
  getSupportedLeague,
} from "@/lib/services/api-football/leagues";
export type {
  SupportedLeague,
  SupportedLeagueId,
} from "@/lib/services/api-football/leagues";
