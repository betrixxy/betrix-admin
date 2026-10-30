import { z } from "zod";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { standingsResponseRawSchema, toStandingsGroups } from "@/lib/services/api-football/standings-mappers";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import { getLeagueSeasons } from "@/lib/services/api-football/weekly-fixtures";
import type { Result } from "@/types/result";
import type { StandingsLoadResult, StandingsTable } from "@/types/standings";

/** Puan durumu maç bitiminde değişir — kısa önbellek yeterli (yalnızca başarılı yanıt önbelleğe girer). */
const STANDINGS_TTL_MS = 10 * 60 * 1000;

/** Ligin seçilen sezondaki puan durumu (gruplu turnuvada her grup ayrı). */
export async function getStandings(leagueId: number, season: number): Promise<Result<StandingsTable, ApiFootballError>> {
  const raw = await apiFootballRequest("/standings", { league: String(leagueId), season: String(season) }, { ttlMs: STANDINGS_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = standingsResponseRawSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_RESPONSE", message: `API-Football /standings yanıtı beklenen şemaya uymuyor: ${parsed.error.message}` } };
  const league = parsed.data.response[0]?.league;
  const groups = toStandingsGroups(league?.standings ?? []);
  if (!league || groups.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: `${season} sezonu için puan durumu bulunamadı.` } };
  return { ok: true, data: { season, leagueLogoUrl: league.logo, groups } };
}

/** Form açılışı: sezonlar + (verilmezse güncel) sezonun tablosu. */
export async function loadStandings(leagueId: number, season?: number): Promise<Result<StandingsLoadResult, ApiFootballError>> {
  const seasons = await getLeagueSeasons(leagueId);
  if (!seasons.ok) return seasons;
  const chosen = season ?? seasons.data.current;
  const table = await getStandings(leagueId, chosen);
  if (!table.ok) return table;
  return { ok: true, data: { ...table.data, seasons: seasons.data.seasons.includes(chosen) ? seasons.data.seasons : [chosen, ...seasons.data.seasons] } };
}

const roundStatusSchema = z.object({ response: z.array(z.object({ fixture: z.object({ status: z.object({ short: z.string() }) }) })) });
/** Tur durumu canlı maçta değişir. */
const ROUND_TTL_MS = 60 * 1000;

/**
 * Lig turunun ("Regular Season - 10") maç durumları — Puan Durumu "HAFTA SONU / DEVAM EDİYOR" etiketi için
 * (yalnızca okuma). Okunamazsa null (etiket oynanan maç sayılarına düşer).
 */
export async function getRoundStatuses(leagueId: number, season: number, round: string): Promise<string[] | null> {
  const raw = await apiFootballRequest("/fixtures", { league: String(leagueId), season: String(season), round }, { ttlMs: ROUND_TTL_MS });
  if (!raw.ok) return null;
  const parsed = roundStatusSchema.safeParse(raw.data);
  return parsed.success ? parsed.data.response.map((entry) => entry.fixture.status.short) : null;
}
