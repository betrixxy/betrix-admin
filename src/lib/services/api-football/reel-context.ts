import { z } from "zod";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/**
 * Reels futbol okumasının ham uçları. Alan adları resmî OpenAPI belgesinden (API-Football 3.9.3, 2026-11-03) doğrulandı;
 * canlı yanıtla henüz sınanmadı. `average` belgede sayı gibi görünür, sağlayıcı dizgi de verebildiği için ikisi kabul edilir.
 * Tazelik belgeden: istatistik günde iki, eksik 4 saatte bir güncellenir.
 */

const STATISTICS_TTL_MS = 6 * 60 * 60 * 1000;
const STANDINGS_TTL_MS = 10 * 60 * 1000;
const INJURIES_TTL_MS = 60 * 60 * 1000;
const SIDELINED_TTL_MS = 6 * 60 * 60 * 1000;

const count = z.number().nullish();
const minuteBucket = z.object({ total: count }).partial();
const homeAwayTotal = z.object({ home: count, away: count, total: count }).partial();
const average = z.union([z.number(), z.string()]).nullish();
const goalSide = z.object({
  total: homeAwayTotal.nullish(),
  average: z.object({ home: average, away: average, total: average }).partial().nullish(),
  minute: z.record(z.string(), minuteBucket).nullish(),
}).partial();

export const teamStatisticsRawSchema = z.object({
  form: z.string().nullish(),
  fixtures: z.object({ played: homeAwayTotal, wins: homeAwayTotal, draws: homeAwayTotal, loses: homeAwayTotal }).partial().nullish(),
  goals: z.object({ for: goalSide, against: goalSide }).partial().nullish(),
  biggest: z.object({ streak: z.object({ wins: count, draws: count, loses: count }).partial().nullish() }).partial().nullish(),
  clean_sheet: homeAwayTotal.nullish(),
  failed_to_score: homeAwayTotal.nullish(),
  lineups: z.array(z.object({ formation: z.string().nullish(), played: count })).nullish(),
});
export type TeamStatisticsRaw = z.infer<typeof teamStatisticsRawSchema>;

const venueRaw = z.object({ played: count, win: count, draw: count, lose: count, goals: z.object({ for: count, against: count }).partial().nullish() }).partial();
export const standingRowRawSchema = z.object({ rank: z.number(), team: z.object({ id: z.number() }), points: count, goalsDiff: count, all: venueRaw.nullish(), home: venueRaw.nullish(), away: venueRaw.nullish() });
export type ReelStandingRowRaw = z.infer<typeof standingRowRawSchema>;

export const injuryRawSchema = z.object({ player: z.object({ id: z.number(), name: z.string(), type: z.string().nullish(), reason: z.string().nullish() }), team: z.object({ id: z.number() }) });
export type InjuryRaw = z.infer<typeof injuryRawSchema>;

export const sidelinedRawSchema = z.object({ type: z.string().nullish(), start: z.string().nullish(), end: z.string().nullish() });
export type SidelinedRaw = z.infer<typeof sidelinedRawSchema>;

async function parsedList<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>, ttlMs: number): Promise<Result<T[], ApiFootballError>> {
  const raw = await apiFootballRequest(path, params, { ttlMs });
  if (!raw.ok) return raw;
  const parsed = z.object({ response: z.array(schema) }).safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_RESPONSE", message: `API-Football ${path} yanıtı beklenen şemaya uymuyor: ${parsed.error.message}` } };
  return { ok: true, data: parsed.data.response };
}

export async function getTeamStatistics(teamId: number, leagueId: number, season: number): Promise<Result<TeamStatisticsRaw, ApiFootballError>> {
  const raw = await apiFootballRequest("/teams/statistics", { team: String(teamId), league: String(leagueId), season: String(season) }, { ttlMs: STATISTICS_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = z.object({ response: teamStatisticsRawSchema }).safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_RESPONSE", message: `API-Football /teams/statistics yanıtı beklenen şemaya uymuyor: ${parsed.error.message}` } };
  return { ok: true, data: parsed.data.response };
}

/** Tablo satırları (gruplu turnuvada bütün gruplar düz liste). */
export async function getStandingRows(leagueId: number, season: number): Promise<Result<ReelStandingRowRaw[], ApiFootballError>> {
  const list = await parsedList("/standings", { league: String(leagueId), season: String(season) }, z.object({ league: z.object({ standings: z.array(z.array(standingRowRawSchema)) }) }), STANDINGS_TTL_MS);
  if (!list.ok) return list;
  return { ok: true, data: list.data.flatMap((entry) => entry.league.standings.flat()) };
}

export const getFixtureInjuries = (fixtureId: number) => parsedList("/injuries", { fixture: String(fixtureId) }, injuryRawSchema, INJURIES_TTL_MS);
/** Belgede `season`, `team` ile zorunlu. Tarih: o günkü liste. */
export const getTeamInjuriesOn = (teamId: number, season: number, date: string) => parsedList("/injuries", { team: String(teamId), season: String(season), date }, injuryRawSchema, INJURIES_TTL_MS);
export const getPlayerSidelined = (playerId: number) => parsedList("/sidelined", { player: String(playerId) }, sidelinedRawSchema, SIDELINED_TTL_MS);
