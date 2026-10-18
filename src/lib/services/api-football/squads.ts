import { apiFootballRequest } from "@/lib/services/api-football/client";
import {
  apiFootballLeagueSeasonsResponseSchema,
  apiFootballProfilesResponseSchema,
  apiFootballSeasonPlayersResponseSchema,
  apiFootballSquadsResponseSchema,
  apiFootballTeamsResponseSchema,
  type ApiFootballError,
  type ApiFootballPlayerProfileRaw,
} from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";
import type { z } from "zod";

/**
 * Lig → takım → oyuncu listeleri (medya havuzu için, bkz. scripts/build-media-server.ts).
 * Bu çağrılar toplu/tek seferlik olduğundan süreç içi önbelleğe alınmaz (`ttlMs: 0`);
 * kalıcı önbellek çağıranın sorumluluğundadır.
 */

const NO_MEMORY_CACHE = { ttlMs: 0 } as const;
/** `/players` sayfalaması için güvenlik sınırı — bir takımın sezon listesi bunu asla aşmaz. */
const MAX_PLAYER_PAGES = 15;

export interface LeagueSeason {
  leagueId: number;
  leagueName: string;
  country: string | null;
  season: number;
}

export interface LeagueTeam {
  id: number;
  name: string;
  country: string | null;
}

export interface SquadEntry {
  id: number;
  name: string | null;
  number: number | null;
  /** "Goalkeeper" | "Defender" | "Midfielder" | "Attacker" — fotoğraf arşivinin mevki grubu. */
  position: string | null;
}

function invalid(path: string, error: z.ZodError): ApiFootballError {
  return { code: "INVALID_RESPONSE", message: `API-Football ${path} yanıtı beklenen şemaya uymuyor: ${error.message}` };
}

/** Ligin API-Football'da "current" işaretli sezonunu döndürür. */
export async function getLeagueCurrentSeason(leagueId: number): Promise<Result<LeagueSeason, ApiFootballError>> {
  const raw = await apiFootballRequest("/leagues", { id: String(leagueId), current: "true" }, NO_MEMORY_CACHE);
  if (!raw.ok) return raw;
  const parsed = apiFootballLeagueSeasonsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/leagues", parsed.error) };

  const entry = parsed.data.response[0];
  const season = entry?.seasons.find((s) => s.current);
  if (!entry || !season) {
    return { ok: false, error: { code: "NOT_FOUND", message: `Lig ${leagueId} için güncel sezon bulunamadı.` } };
  }
  return {
    ok: true,
    data: { leagueId, leagueName: entry.league.name, country: entry.country.name, season: season.year },
  };
}

export async function getLeagueTeams(
  leagueId: number,
  season: number,
): Promise<Result<LeagueTeam[], ApiFootballError>> {
  const raw = await apiFootballRequest(
    "/teams",
    { league: String(leagueId), season: String(season) },
    NO_MEMORY_CACHE,
  );
  if (!raw.ok) return raw;
  const parsed = apiFootballTeamsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/teams", parsed.error) };
  return {
    ok: true,
    data: parsed.data.response
      .filter((r) => r.team.national !== true)
      .map((r) => ({ id: r.team.id, name: r.team.name, country: r.team.country })),
  };
}

/** Takımın sezon oyuncuları (doğum tarihi dahil) — tüm sayfalar. */
export async function getTeamSeasonPlayers(
  teamId: number,
  season: number,
): Promise<Result<ApiFootballPlayerProfileRaw[], ApiFootballError>> {
  const players: ApiFootballPlayerProfileRaw[] = [];
  for (let page = 1; page <= MAX_PLAYER_PAGES; page += 1) {
    const raw = await apiFootballRequest(
      "/players",
      { team: String(teamId), season: String(season), page: String(page) },
      NO_MEMORY_CACHE,
    );
    if (!raw.ok) return raw;
    const parsed = apiFootballSeasonPlayersResponseSchema.safeParse(raw.data);
    if (!parsed.success) return { ok: false, error: invalid("/players", parsed.error) };

    players.push(...parsed.data.response.map((r) => r.player));
    if (parsed.data.paging.current >= parsed.data.paging.total) return { ok: true, data: players };
  }
  return {
    ok: false,
    error: { code: "INVALID_RESPONSE", message: `Takım ${teamId}: /players ${MAX_PLAYER_PAGES} sayfayı aştı.` },
  };
}

/** Güncel kadro (forma numarası dahil, doğum tarihi yok). */
export async function getTeamSquad(teamId: number): Promise<Result<SquadEntry[], ApiFootballError>> {
  const raw = await apiFootballRequest("/players/squads", { team: String(teamId) }, NO_MEMORY_CACHE);
  if (!raw.ok) return raw;
  const parsed = apiFootballSquadsResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/players/squads", parsed.error) };
  return {
    ok: true,
    data: parsed.data.response.flatMap((r) =>
      r.players.map((p) => ({ id: p.id, name: p.name, number: p.number ?? null, position: p.position ?? null })),
    ),
  };
}

/** Tek oyuncunun profili (doğum tarihi için) — kadroda olup sezon listesinde olmayanlar. */
export async function getPlayerProfile(
  playerId: number,
): Promise<Result<ApiFootballPlayerProfileRaw | null, ApiFootballError>> {
  const raw = await apiFootballRequest("/players/profiles", { player: String(playerId) }, NO_MEMORY_CACHE);
  if (!raw.ok) return raw;
  const parsed = apiFootballProfilesResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: invalid("/players/profiles", parsed.error) };
  return { ok: true, data: parsed.data.response[0]?.player ?? null };
}
