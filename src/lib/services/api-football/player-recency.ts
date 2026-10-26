import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiFootballFixturePlayersResponseSchema, type ApiFootballFixturePlayers } from "@/lib/services/api-football/player-season-types";
import { apiFootballFixturesResponseSchema, type ApiFootballError, type ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/** Takımın sezon maç listesi: form ile aynı 30 dk tazelik (bkz. CLAUDE.md 2.3). */
const LIST_TTL_MS = 30 * 60 * 1000;
/** Bitmiş maçın oyuncu istatistiği değişmez. */
const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IDS = 20;
const FINISHED = "FT-AET-PEN";

const invalid = (path: string, message: string): ApiFootballError => ({ code: "INVALID_RESPONSE", message: `API-Football ${path} yanıtı beklenen şemaya uymuyor: ${message}` });

/** Takımın sezonda bitmiş maçları (lig verilirse yalnızca o lig), eskiden yeniye. */
export async function getTeamFinishedFixtures(teamId: number, season: number, leagueId: number | null): Promise<Result<ApiFootballFixtureRaw[], ApiFootballError>> {
  const params: Record<string, string> = { team: String(teamId), season: String(season), status: FINISHED };
  if (leagueId !== null) params.league = String(leagueId);
  const raw = await apiFootballRequest("/fixtures", params, { ttlMs: LIST_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = apiFootballFixturesResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/fixtures", parsed.error.message) };
  return { ok: true, data: [...parsed.data.response].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp) };
}

/** Maçların oyuncu istatistikleri (20'lik gruplar). */
export async function getFixturePlayers(fixtureIds: number[]): Promise<Result<ApiFootballFixturePlayers[], ApiFootballError>> {
  const ids = [...new Set(fixtureIds)];
  const out: ApiFootballFixturePlayers[] = [];
  for (let i = 0; i < ids.length; i += MAX_IDS) {
    const raw = await apiFootballRequest("/fixtures", { ids: ids.slice(i, i + MAX_IDS).join("-") }, { ttlMs: DETAIL_TTL_MS });
    if (!raw.ok) return raw;
    const parsed = apiFootballFixturePlayersResponseSchema.safeParse(raw.data);
    if (!parsed.success) return { ok: false, error: invalid("/fixtures?ids", parsed.error.message) };
    out.push(...parsed.data.response);
  }
  return { ok: true, data: out };
}
