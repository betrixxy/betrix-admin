import { competitionCardName } from "@/lib/names/competition-names";
import { leagueFixturesFromApi, teamsFromApi, tiesFromApi } from "@/lib/draw/api-mappers";
import { DRAW_COMPETITIONS, drawRound } from "@/lib/draw/rounds";
import { emptyParticipantsReason, turkishLeagueScope, type LeagueSeasonInfo } from "@/lib/draw/season-draws";
import { headToHeadRecord } from "@/lib/draw/facts";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiSearchTerm } from "@/lib/services/api-football/search-term";
import { searchTeams } from "@/lib/services/api-football/team-directory";
import { apiFootballFixturesResponseSchema, apiFootballLeagueSeasonsRawSchema, apiFootballTeamsResponseSchema, type ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import { z } from "zod";
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
      competition: { id: request.competitionId, name: competitionCardName(request.competitionId, scoped[0]?.league.name ?? "") },
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

/** Katılımcı listesi + liste boşsa ekranda yazılacak neden. */
export interface DrawParticipantsResult {
  teams: DrawTeam[];
  emptyReason: string | null;
}

const leaguesSchema = z.object({ response: z.array(apiFootballLeagueSeasonsRawSchema) });

/** Liste boş geldiğinde nedeni ayırt etmek için lig + sezon bilgisi (`/leagues?id=&season=`); okunamazsa null. */
async function leagueSeasonInfo(competitionId: number, season: number): Promise<LeagueSeasonInfo | null> {
  const raw = await apiFootballRequest("/leagues", { id: String(competitionId), season: String(season) }, { ttlMs: H2H_TTL_MS });
  if (!raw.ok) return null;
  const parsed = leaguesSchema.safeParse(raw.data);
  if (!parsed.success) return null;
  const entry = parsed.data.response[0]?.seasons.find((s) => s.year === season);
  return entry ? { exists: true, current: entry.current, start: entry.start ?? null } : { exists: false, current: false, start: null };
}

/** Kura öncesi hazırlık: turnuvanın o sezonki katılımcıları (`/teams?league=&season=`, yalnızca okuma); torba elle. */
export async function drawParticipants(competitionId: number, season: number): Promise<Result<DrawParticipantsResult>> {
  const raw = await apiFootballRequest("/teams", { league: String(competitionId), season: String(season) }, { ttlMs: H2H_TTL_MS });
  if (!raw.ok) return fail(raw.error.code, raw.error.message);
  const parsed = apiFootballTeamsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return fail("INVALID_RESPONSE", `API-Football /teams yanıtı şemaya uymuyor: ${parsed.error.message}`);
  const teams = parsed.data.response.map(({ team }) => ({ id: team.id, apiName: team.name, country: team.country ?? null, logoUrl: team.logo ?? null, pot: null }));
  const name = competitionCardName(competitionId, `Turnuva ${competitionId}`);
  const emptyReason = teams.length ? null : emptyParticipantsReason(name, season, await leagueSeasonInfo(competitionId, season));
  return { ok: true, data: { teams, emptyReason } };
}

/** Sezonun Avrupa kuraları: her kupanın lig aşaması, Türk takımlarına daraltılmış; Türk takımı/fikstür yoksa atlanır (neden `skipped`). */
export async function seasonEuropeanDraws(season: number): Promise<Result<{ states: DrawState[]; skipped: string[] }>> {
  const league = drawRound("LEAGUE")!;
  const results = await Promise.all(
    DRAW_COMPETITIONS.map(async (competition) => ({ competition, result: await drawFromApi({ competitionId: competition.id, season, stage: league.stage, roundLabel: league.label }) })),
  );
  const states: DrawState[] = [];
  const skipped: string[] = [];
  for (const { competition, result } of results) {
    if (!result.ok) {
      skipped.push(`${competition.short}: ${result.error.code === "NO_FIXTURES" ? "lig aşaması fikstürü API'de yok" : result.error.message}.`);
      continue;
    }
    const scoped = turkishLeagueScope({ ...result.data, competition: { id: competition.id, name: competition.name } });
    if (scoped) states.push(scoped);
    else skipped.push(`${competition.short}: lig aşamasında Türk takımı yok.`);
  }
  // Hiçbir kupa okunamadıysa (ağ/kota) boş sonuç değil hata — ekranda API mesajı yazar.
  if (results.every(({ result }) => !result.ok && result.error.code !== "NO_FIXTURES")) return fail("API_ERROR", skipped.join(" "));
  return { ok: true, data: { states, skipped } };
}

/** Elle katılımcı ekleme: adla arama (`/teams?search=`). */
export async function searchDrawTeams(query: string): Promise<Result<DrawTeam[]>> {
  if (!apiSearchTerm(query)) return { ok: true, data: [] };
  const found = await searchTeams(query);
  if (!found.ok) return fail(found.error.code, found.error.message);
  return { ok: true, data: found.data.filter((team) => !team.national).map((team) => ({ id: team.id, apiName: team.name, country: team.country, logoUrl: team.logo, pot: null })) };
}
