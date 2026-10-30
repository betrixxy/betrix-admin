import { apiFootballRequest } from "@/lib/services/api-football/client";
import { apiFootballHalfStatisticsResponseSchema, type ApiFootballHalfTeamStatisticsRaw } from "@/lib/services/api-football/half-stats-types";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/** Bitmiş maçın devre istatistiği sonradan nadiren düzeltilir; kısa önbellek yeterli. */
const HALF_STATS_TTL_MS = 10 * 60 * 1000;

/**
 * Maç Analizi 02'nin birincil kaynağı — `/fixtures/statistics?fixture=<id>&half=true` (tek istek). İki takımın
 * satırları; devre bloğu gelmediyse takım satırlarında `statistics_1h`/`statistics_2h` boş dizidir.
 */
export async function getHalfStatisticsRaw(apiFootballId: number): Promise<Result<ApiFootballHalfTeamStatisticsRaw[], ApiFootballError>> {
  const raw = await apiFootballRequest("/fixtures/statistics", { fixture: String(apiFootballId), half: "true" }, { ttlMs: HALF_STATS_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = apiFootballHalfStatisticsResponseSchema.safeParse(raw.data);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: `Devre istatistiği yanıtı şemaya uymuyor: ${parsed.error.message}` } };
  }
  return { ok: true, data: parsed.data.response };
}
