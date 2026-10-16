import { apiFootballRequest } from "@/lib/services/api-football/client";
import {
  apiFootballFixtureResultsResponseSchema,
  type ApiFootballError,
  type ApiFootballFixtureResultRaw,
} from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

/** Durum (canlı → bitti) değişebilir; kısa tutulur. Tek istek: olaylar + oyuncular + kadro birlikte gelir. */
const RESULT_TTL_MS = 60 * 1000;

/** Maç Sonucu stüdyosunun ham verisi — `/fixtures?id=`. Sağlayıcı maçı bulamazsa `null`. */
export async function getMatchResultRaw(apiFootballId: number): Promise<Result<ApiFootballFixtureResultRaw | null, ApiFootballError>> {
  const raw = await apiFootballRequest("/fixtures", { id: String(apiFootballId) }, { ttlMs: RESULT_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = apiFootballFixtureResultsResponseSchema.safeParse(raw.data);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: `Maç sonucu yanıtı şemaya uymuyor: ${parsed.error.message}` } };
  }
  return { ok: true, data: parsed.data.response[0] ?? null };
}
