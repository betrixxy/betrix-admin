import { domesticLeague } from "@/lib/archive/structure";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { getFixtureDetailsByIds } from "@/lib/services/api-football/fixtures";
import { computeSeasonLeagueXg, selectFinishedBefore } from "@/lib/services/api-football/form-mappers";
import { getTeamCurrentLeagues, getTeamInfo } from "@/lib/services/api-football/team-directory";
import { apiFootballFixturesResponseSchema, type ApiFootballError } from "@/lib/services/api-football/types";
import type { SeasonLeagueXg } from "@/types/deep-analysis";
import type { Result } from "@/types/result";

/** Sezon maç listesi: form ile aynı 30 dk tazelik (bkz. CLAUDE.md 2.3). */
const SEASON_FIXTURES_TTL_MS = 30 * 60 * 1000;

/**
 * Takımın bu sezonki yurt içi LİG maçlarından xG (vitrin gerekçesinin xG kaynağı). İstekler: takım
 * ve ligleri (6 sa önbellek), lig+sezon maç listesi, bitmiş maçların detayı (20'lik gruplar).
 * Yurt içi lig ya da güncel sezon bulunamazsa (milli takım vb.) `null` — xG pakete girmez.
 */
export async function getSeasonLeagueXg(teamId: number, beforeUtc: string): Promise<Result<SeasonLeagueXg | null, ApiFootballError>> {
  const [info, leagues] = await Promise.all([getTeamInfo(teamId), getTeamCurrentLeagues(teamId)]);
  if (!info.ok) return info;
  if (!leagues.ok) return leagues;
  const league = domesticLeague(leagues.data, info.data?.country ?? null);
  if (!league || league.season === null) return { ok: true, data: null };
  const season = league.season;

  const list = await apiFootballRequest(
    "/fixtures",
    { team: String(teamId), league: String(league.id), season: String(season) },
    { ttlMs: SEASON_FIXTURES_TTL_MS },
  );
  if (!list.ok) return list;
  const parsed = apiFootballFixturesResponseSchema.safeParse(list.data);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: `Takım sezon maçları şemaya uymuyor: ${parsed.error.message}` } };
  }
  const finished = selectFinishedBefore(parsed.data.response, beforeUtc, parsed.data.response.length);
  const details = await getFixtureDetailsByIds(finished.map((raw) => raw.fixture.id));
  if (!details.ok) return details;
  return { ok: true, data: computeSeasonLeagueXg(details.data, teamId, { id: league.id, name: league.name, season }, beforeUtc) };
}
