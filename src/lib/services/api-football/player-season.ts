import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiFootballPlayerSeasonResponseSchema, type ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/** Sezon istatistiği maç sonrası değişir; maç önü kart için 30 dk tazelik yeterli (bkz. CLAUDE.md 2.3). */
const PLAYER_SEASON_TTL_MS = 30 * 60 * 1000;

/** Oyuncunun sezonu: profil + takım × turnuva kayıtları. Bulunamazsa NOT_FOUND. */
export async function getPlayerSeason(playerId: number, season: number): Promise<Result<ApiFootballPlayerSeason, ApiFootballError>> {
  const raw = await apiFootballRequest("/players", { id: String(playerId), season: String(season) }, { ttlMs: PLAYER_SEASON_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = apiFootballPlayerSeasonResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_RESPONSE", message: `API-Football /players yanıtı beklenen şemaya uymuyor: ${parsed.error.message}` } };
  const entry = parsed.data.response[0];
  if (!entry) return { ok: false, error: { code: "NOT_FOUND", message: `Oyuncu ${playerId} için ${season} sezon verisi yok.` } };
  return { ok: true, data: entry };
}
