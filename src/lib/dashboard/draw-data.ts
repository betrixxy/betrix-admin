import { OFFICIAL_COMPETITION_NAMES } from "@/lib/dashboard/match-result-labels";
import { leagueFixturesFromApi, teamsFromApi, tiesFromApi } from "@/lib/draw/api-mappers";
import { headToHeadRecord } from "@/lib/draw/facts";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiSearchTerm } from "@/lib/services/api-football/search-term";
import { searchTeams } from "@/lib/services/api-football/team-directory";
import { apiFootballFixturesResponseSchema, apiFootballTeamsResponseSchema, type ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { DrawStage, DrawState, DrawTeam, HeadToHeadRecord } from "@/types/draw";
import type { Result } from "@/types/result";

/**
 * Kura kartının API verisi (yalnızca okuma): kura sonrası karşılaştırma ve gerçek örnekler için turnuvanın
 * sezon fikstüründen kura durumu; eşleşmenin geçmiş karşılaşmaları (olgu satırı). Kura SIRASINDA veri elle
 * girilir (API henüz fikstür vermez) — bkz. `lib/draw/entry.ts`.
 */

const TTL_MS = 30 * 60 * 1000;
const H2H_TTL_MS = 6 * 60 * 60 * 1000;

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

async function competitionFixtures(competitionId: number, season: number): Promise<Result<ApiFootballFixtureRaw[]>> {
  const raw = await apiFootballRequest("/fixtures", { league: String(competitionId), season: String(season) }, { ttlMs: TTL_MS });
  if (!raw.ok) return fail(raw.error.code, raw.error.message);
  const parsed = apiFootballFixturesResponseSchema.safeParse(raw.data);
  return parsed.success ? { ok: true, data: parsed.data.response } : fail("INVALID_RESPONSE", `API-Football /fixtures yanıtı şemaya uymuyor: ${parsed.error.message}`);
}

async function competitionCountries(competitionId: number, season: number): Promise<Map<number, string>> {
  const raw = await apiFootballRequest("/teams", { league: String(competitionId), season: String(season) }, { ttlMs: H2H_TTL_MS });
  if (!raw.ok) return new Map();
  const parsed = apiFootballTeamsResponseSchema.safeParse(raw.data);
  return parsed.success ? new Map(parsed.data.response.flatMap((r) => (r.team.country ? [[r.team.id, r.team.country] as const] : []))) : new Map();
}

export interface DrawFromApiRequest {
  competitionId: number;
  season: number;
  stage: DrawStage;
  roundLabel: string;
  /** Eleme turu: API round deseni (ör. /Round of 16/). */
  round?: RegExp | undefined;
  drawDateUtc?: string | null;
}

/** Turnuvanın API fikstüründen kura durumu (lig aşamasında bütün takımların rakipleri). */
export async function drawFromApi(request: DrawFromApiRequest): Promise<Result<DrawState>> {
  const [fixtures, countries] = await Promise.all([competitionFixtures(request.competitionId, request.season), competitionCountries(request.competitionId, request.season)]);
  if (!fixtures.ok) return fixtures;
  const scoped = request.stage === "LEAGUE_PHASE" ? fixtures.data.filter((f) => /League Stage|League Phase/i.test(f.league.round)) : fixtures.data.filter((f) => request.round?.test(f.league.round));
  if (scoped.length === 0) return fail("NO_FIXTURES", `API'de bu turun fikstürü yok (${request.roundLabel}).`);
  return {
    ok: true,
    data: {
      competition: { id: request.competitionId, name: OFFICIAL_COMPETITION_NAMES[request.competitionId] ?? scoped[0]?.league.name ?? "" },
      season: request.season,
      roundLabel: request.roundLabel,
      stage: request.stage,
      drawDateUtc: request.drawDateUtc ?? null,
      teams: teamsFromApi(scoped, countries),
      ties: request.stage === "KNOCKOUT" && request.round ? tiesFromApi(scoped, request.round) : [],
      fixtures: request.stage === "LEAGUE_PHASE" ? leagueFixturesFromApi(scoped) : [],
      nameOverrides: {},
    },
  };
}

/** Odak takımın rakiple geçmişi (bitmiş maçlar, `beforeUtc` öncesi); veri yoksa null. */
export async function drawHeadToHead(teamId: number, opponentId: number, beforeUtc: string): Promise<HeadToHeadRecord | null> {
  const raw = await apiFootballRequest("/fixtures/headtohead", { h2h: `${teamId}-${opponentId}` }, { ttlMs: H2H_TTL_MS });
  if (!raw.ok) return null;
  const parsed = apiFootballFixturesResponseSchema.safeParse(raw.data);
  return parsed.success ? headToHeadRecord(parsed.data.response, teamId, beforeUtc) : null;
}

/** Kura öncesi hazırlık: turnuvanın o sezonki katılımcıları (`/teams?league=&season=`, yalnızca okuma); torba elle. */
export async function drawParticipants(competitionId: number, season: number): Promise<Result<DrawTeam[]>> {
  const raw = await apiFootballRequest("/teams", { league: String(competitionId), season: String(season) }, { ttlMs: H2H_TTL_MS });
  if (!raw.ok) return fail(raw.error.code, raw.error.message);
  const parsed = apiFootballTeamsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return fail("INVALID_RESPONSE", `API-Football /teams yanıtı şemaya uymuyor: ${parsed.error.message}`);
  return { ok: true, data: parsed.data.response.map(({ team }) => ({ id: team.id, apiName: team.name, country: team.country ?? null, logoUrl: team.logo ?? null, pot: null })) };
}

/** Elle katılımcı ekleme: adla arama (`/teams?search=`). */
export async function searchDrawTeams(query: string): Promise<Result<DrawTeam[]>> {
  if (!apiSearchTerm(query)) return { ok: true, data: [] };
  const found = await searchTeams(query);
  if (!found.ok) return fail(found.error.code, found.error.message);
  return { ok: true, data: found.data.filter((team) => !team.national).map((team) => ({ id: team.id, apiName: team.name, country: team.country, logoUrl: team.logo, pot: null })) };
}
