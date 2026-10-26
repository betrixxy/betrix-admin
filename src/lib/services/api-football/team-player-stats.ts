import { z } from "zod";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiFootballPlayerSeasonSchema, type ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/** Kadro istatistiği maç sonrası değişir; öneri için 6 saat yeterli. */
const TTL_MS = 6 * 60 * 60 * 1000;
/** Bir takımın sezon oyuncu listesi bunu aşmaz. */
const MAX_PAGES = 6;

const pageSchema = z.object({ response: z.array(apiFootballPlayerSeasonSchema), paging: z.object({ current: z.number(), total: z.number() }) });

/** Takımın bir ligdeki sezon oyuncuları (istatistikleriyle) — stüdyonun "gol+asist lideri" önerisi. */
export async function getTeamLeaguePlayers(teamId: number, season: number, leagueId: number): Promise<Result<ApiFootballPlayerSeason[], ApiFootballError>> {
  const players: ApiFootballPlayerSeason[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const raw = await apiFootballRequest("/players", { team: String(teamId), season: String(season), league: String(leagueId), page: String(page) }, { ttlMs: TTL_MS });
    if (!raw.ok) return raw;
    const parsed = pageSchema.safeParse(raw.data);
    if (!parsed.success) return { ok: false, error: { code: "INVALID_RESPONSE", message: `API-Football /players yanıtı beklenen şemaya uymuyor: ${parsed.error.message}` } };
    players.push(...parsed.data.response);
    if (parsed.data.paging.current >= parsed.data.paging.total) break;
  }
  return { ok: true, data: players };
}
