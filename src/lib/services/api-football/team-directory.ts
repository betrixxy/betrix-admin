import { officialPersonName } from "@/lib/archive/names";
import { currentCoach } from "@/lib/archive/structure";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiSearchTerm } from "@/lib/services/api-football/search-term";
import {
  apiFootballCoachsResponseSchema,
  apiFootballLeagueSeasonsResponseSchema,
  apiFootballTeamsResponseSchema,
  type ApiFootballCoachRaw,
  type ApiFootballError,
} from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/**
 * Fotoğraf arşivi için takım dizini (bkz. `lib/archive/sync.ts`): takım bilgisi, takımın güncel
 * ligleri ve teknik direktörü. Kadro ve sezon oyuncuları `squads.ts`'ten. Sonuçlar süreç içinde
 * 6 saat önbelleklenir; arşiv ayrıca DB'de `squadSyncedAt` ile 7 gün içinde tekrar istemez.
 */

const ARCHIVE_TTL = { ttlMs: 6 * 60 * 60 * 1000 } as const;

const invalid = (path: string, message: string): ApiFootballError => ({ code: "INVALID_RESPONSE", message: `API-Football ${path} yanıtı beklenen şemaya uymuyor: ${message}` });

export interface TeamInfo {
  id: number;
  name: string;
  country: string | null;
  national: boolean;
  logo: string | null;
}

export async function getTeamInfo(teamId: number): Promise<Result<TeamInfo | null, ApiFootballError>> {
  const raw = await apiFootballRequest("/teams", { id: String(teamId) }, ARCHIVE_TTL);
  if (!raw.ok) return raw;
  const parsed = apiFootballTeamsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/teams", parsed.error.message) };
  const team = parsed.data.response[0]?.team;
  return { ok: true, data: team ? { id: team.id, name: team.name, country: team.country, national: team.national === true, logo: team.logo ?? null } : null };
}

export interface TeamLeague {
  id: number;
  name: string;
  type: string;
  country: string | null;
  logo: string | null;
  /** Güncel sezon yılı (`seasons[].current`) — yoksa null. */
  season: number | null;
}

/** Takımın bu sezon oynadığı ligler/kupalar (`current=true`) — yurt içi lig `domesticLeague` ile seçilir. */
export async function getTeamCurrentLeagues(teamId: number): Promise<Result<TeamLeague[], ApiFootballError>> {
  const raw = await apiFootballRequest("/leagues", { team: String(teamId), current: "true" }, ARCHIVE_TTL);
  if (!raw.ok) return raw;
  const parsed = apiFootballLeagueSeasonsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/leagues", parsed.error.message) };
  return {
    ok: true,
    data: parsed.data.response.map((entry) => ({
      id: entry.league.id,
      name: entry.league.name,
      type: entry.league.type ?? "",
      country: entry.country.name,
      logo: entry.league.logo ?? null,
      season: entry.seasons.find((season) => season.current)?.year ?? null,
    })),
  };
}

export async function getTeamCoach(teamId: number): Promise<Result<ApiFootballCoachRaw | null, ApiFootballError>> {
  const raw = await apiFootballRequest("/coachs", { team: String(teamId) }, ARCHIVE_TTL);
  if (!raw.ok) return raw;
  const parsed = apiFootballCoachsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/coachs", parsed.error.message) };
  return { ok: true, data: currentCoach(parsed.data.response, teamId) };
}

export interface CoachSearchHit {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  nationality: string | null;
  /** Kariyerinde bitişi olmayan takım (biliniyorsa). */
  currentTeam: string | null;
}

/** Teknik direktör adla arama (`/coachs?search=`, yalnızca okuma). */
export async function searchCoaches(query: string): Promise<Result<CoachSearchHit[], ApiFootballError>> {
  const term = apiSearchTerm(query);
  if (!term) return { ok: true, data: [] }; // çağıran `apiSearchTerm` ile önceden doğrular
  const raw = await apiFootballRequest("/coachs", { search: term }, ARCHIVE_TTL);
  if (!raw.ok) return raw;
  const parsed = apiFootballCoachsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/coachs", parsed.error.message) };
  return {
    ok: true,
    data: parsed.data.response.slice(0, 20).map((coach) => ({
      id: coach.id,
      // Arşivdeki ad kuralıyla açılmış ad ("V. Italiano" → "Vincenzo Italiano").
      name: officialPersonName(coach.name?.trim() ?? "", coach.firstname, coach.lastname),
      firstname: coach.firstname,
      lastname: coach.lastname,
      nationality: coach.nationality ?? null,
      currentTeam: coach.career.find((stint) => stint.end === null)?.team.name ?? null,
    })),
  };
}

/** Takım adla arama (`/teams?search=`, yalnızca okuma). */
export async function searchTeams(query: string): Promise<Result<TeamInfo[], ApiFootballError>> {
  const term = apiSearchTerm(query);
  if (!term) return { ok: true, data: [] }; // çağıran `apiSearchTerm` ile önceden doğrular
  const raw = await apiFootballRequest("/teams", { search: term }, ARCHIVE_TTL);
  if (!raw.ok) return raw;
  const parsed = apiFootballTeamsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/teams", parsed.error.message) };
  return {
    ok: true,
    data: parsed.data.response.slice(0, 20).map(({ team }) => ({ id: team.id, name: team.name, country: team.country, national: team.national === true, logo: team.logo ?? null })),
  };
}

/** Tek teknik direktör kimlikle — arşive eklerken ad formdan değil API'den alınır. */
export async function getCoachById(coachId: number): Promise<Result<ApiFootballCoachRaw | null, ApiFootballError>> {
  const raw = await apiFootballRequest("/coachs", { id: String(coachId) }, ARCHIVE_TTL);
  if (!raw.ok) return raw;
  const parsed = apiFootballCoachsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/coachs", parsed.error.message) };
  return { ok: true, data: parsed.data.response[0] ?? null };
}
