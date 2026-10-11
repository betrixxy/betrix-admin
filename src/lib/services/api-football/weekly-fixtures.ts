import { z } from "zod";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiFootballFixturesResponseSchema, type ApiFootballError } from "@/lib/services/api-football/types";
import { roundKeyOf, roundOptions, standingsGroupMap, toWeeklyMatch } from "@/lib/services/api-football/weekly-mappers";
import type { Result } from "@/types/result";
import type { WeeklyRoundMatches, WeeklyRoundOption, WeeklyRoundsResult } from "@/types/weekly-fixtures";

/**
 * "Haftanın Maçları": bir ligin sezonları, turları ve seçilen turun maçları (API-Football).
 * Ham şemalar yalnızca bu dosyada kullanıldığı için burada tanımlıdır.
 */

const leaguesResponseSchema = z.object({
  response: z.array(z.object({ seasons: z.array(z.object({ year: z.number(), current: z.boolean() })) })),
});
const roundsResponseSchema = z.object({ response: z.array(z.string()) });
const standingsResponseSchema = z.object({
  response: z.array(
    z.object({ league: z.object({ standings: z.array(z.array(z.object({ group: z.string(), team: z.object({ id: z.number() }) }))) }) }),
  ),
});

/** Sezon listesi nadiren değişir. */
const SEASONS_TTL_MS = 6 * 60 * 60 * 1000;
const ROUNDS_TTL_MS = 30 * 60 * 1000;
/** Skor/saat güncel kalsın — canlı maçlarda dakikası değişir. */
const MATCHES_TTL_MS = 60 * 1000;
const STANDINGS_TTL_MS = 6 * 60 * 60 * 1000;
/** Formda gösterilen sezon sayısı (güncel + öncekiler). */
const SEASON_CHOICES = 3;

function invalid(path: string, error: z.ZodError): ApiFootballError {
  return { code: "INVALID_RESPONSE", message: `API-Football ${path} yanıtı beklenen şemaya uymuyor: ${error.message}` };
}

async function parsed<T extends z.ZodTypeAny>(path: string, params: Record<string, string>, schema: T, ttlMs: number): Promise<Result<z.infer<T>, ApiFootballError>> {
  const raw = await apiFootballRequest(path, params, { ttlMs });
  if (!raw.ok) return raw;
  const result = schema.safeParse(raw.data);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: invalid(path, result.error) };
}

/** Ligin sezonları (yeniden eskiye) ve güncel sezon. */
async function leagueSeasons(leagueId: number): Promise<Result<{ current: number; seasons: number[] }, ApiFootballError>> {
  const result = await parsed("/leagues", { id: String(leagueId) }, leaguesResponseSchema, SEASONS_TTL_MS);
  if (!result.ok) return result;
  const seasons = (result.data.response[0]?.seasons ?? []).toSorted((a, b) => b.year - a.year);
  const current = seasons.find((s) => s.current)?.year ?? seasons[0]?.year;
  if (current === undefined) return { ok: false, error: { code: "NOT_FOUND", message: `Lig ${leagueId} için sezon bulunamadı.` } };
  return { ok: true, data: { current, seasons: seasons.map((s) => s.year).filter((year) => year <= current).slice(0, SEASON_CHOICES) } };
}

/**
 * Ligin tur seçenekleri. `season` verilmezse güncel sezon; "güncel tur" yalnızca güncel sezonda
 * sorulur (geçmiş sezonda form ilk turla açılır).
 */
export async function getWeeklyRounds(leagueId: number, season?: number): Promise<Result<WeeklyRoundsResult, ApiFootballError>> {
  const seasons = await leagueSeasons(leagueId);
  if (!seasons.ok) return seasons;
  const chosen = season ?? seasons.data.current;
  const base = { league: String(leagueId), season: String(chosen) };

  const [rounds, current] = await Promise.all([
    parsed("/fixtures/rounds", base, roundsResponseSchema, ROUNDS_TTL_MS),
    chosen === seasons.data.current ? parsed("/fixtures/rounds", { ...base, current: "true" }, roundsResponseSchema, ROUNDS_TTL_MS) : null,
  ]);
  if (!rounds.ok) return rounds;
  const options = roundOptions(rounds.data.response);
  if (options.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: `${chosen} sezonunda tur bulunamadı.` } };

  const currentRound = current?.ok ? current.data.response[0] : undefined;
  return {
    ok: true,
    data: {
      season: chosen,
      seasons: seasons.data.seasons.includes(chosen) ? seasons.data.seasons : [chosen, ...seasons.data.seasons],
      options,
      currentKey: currentRound ? roundKeyOf(currentRound) : null,
    },
  };
}

/** Grup harfi turda yazmayan kupa formatları için puan durumundan takım → grup eşlemesi. */
async function standingsGroups(leagueId: number, season: number): Promise<Map<number, string>> {
  const result = await parsed("/standings", { league: String(leagueId), season: String(season) }, standingsResponseSchema, STANDINGS_TTL_MS);
  if (!result.ok) return new Map();
  const rows = result.data.response.flatMap((entry) => entry.league.standings.flat());
  return standingsGroupMap(rows.map((row) => ({ group: row.group, teamId: row.team.id })));
}

/** Seçilen turun (grup maç gününde tüm grupların) maçları, başlama saatine göre sıralı, Türkiye saatiyle. */
export async function getWeeklyRoundMatches(leagueId: number, season: number, option: WeeklyRoundOption): Promise<Result<WeeklyRoundMatches, ApiFootballError>> {
  const responses = await Promise.all(
    option.rounds.map((round) =>
      parsed("/fixtures", { league: String(leagueId), season: String(season), round, timezone: "Europe/Istanbul" }, apiFootballFixturesResponseSchema, MATCHES_TTL_MS),
    ),
  );
  const raws = [];
  for (const response of responses) {
    if (!response.ok) return response;
    raws.push(...response.data.response);
  }
  // "Group Stage - 3" gibi harfsiz grup turunda grup bilgisi puan durumundan gelir.
  const groups = /^Group Stage - \d+$/.test(option.rounds[0] ?? "") ? await standingsGroups(leagueId, season) : new Map<number, string>();
  const matches = raws.map((raw) => toWeeklyMatch(raw, groups)).toSorted((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc) || a.home.name.localeCompare(b.home.name, "tr"));
  return { ok: true, data: { leagueLogoUrl: raws[0]?.league.logo ?? "", matches } };
}
