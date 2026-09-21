export { isApiFootballConfigured } from "@/lib/services/api-football/client";
export {
  getFixturesForDateRange,
  getTodaysFixtures,
  getFixturesForCurrentWeek,
} from "@/lib/services/api-football/fixtures";
export type { FixtureDateRange } from "@/lib/services/api-football/fixtures";
export type { ApiFootballError } from "@/lib/services/api-football/types";
export {
  SUPPORTED_LEAGUES,
  isSupportedLeagueId,
  getSupportedLeague,
} from "@/lib/services/api-football/leagues";
export type {
  SupportedLeague,
  SupportedLeagueId,
} from "@/lib/services/api-football/leagues";
