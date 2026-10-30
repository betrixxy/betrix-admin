import { apiFootballRequest } from "@/lib/services/api-football/client";
import { scoreResponseSchema, toScorecardMatch } from "@/lib/services/api-football/fixture-score-mappers";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { ScorecardMatch } from "@/types/prediction-scorecard";
import type { Result } from "@/types/result";

/** Tahmin Karnesi maç skoru — `/fixtures?id=` (yalnızca okuma; eşleme `fixture-score-mappers.ts`). */

/** Kısa önbellek: maç bitince durum ve skor değişir. */
const SCORE_TTL_MS = 60 * 1000;

export async function getScorecardMatch(apiFootballId: number): Promise<Result<ScorecardMatch | null, ApiFootballError>> {
  const raw = await apiFootballRequest("/fixtures", { id: String(apiFootballId) }, { ttlMs: SCORE_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = scoreResponseSchema.safeParse(raw.data);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_RESPONSE", message: `Maç skoru yanıtı şemaya uymuyor: ${parsed.error.message}` } };
  const first = parsed.data.response[0];
  return { ok: true, data: first ? toScorecardMatch(first) : null };
}
