import { checkmatchCoreRequest } from "@/lib/services/checkmatch-core/client";
import { mapCheckmatchCalculationsToMatchCalculations } from "@/lib/services/checkmatch-core/mappers";
import { checkmatchMatchCalculationsRawSchema } from "@/lib/services/checkmatch-core/types";
import type { CheckmatchCoreError } from "@/lib/services/checkmatch-core/types";
import type { Result } from "@/types/result";
import type { MatchCalculations } from "@/types/market";

/**
 * Mac sunucusundan (checkmatch-core) belirli bir maçın hesaplanmış oran/market
 * verilerini çeker (`GET /api/v1/matches/{fixtureId}/calculations`). Ham yanıt zod ile
 * doğrulanır, ardından kanonik `MatchCalculations`'a eşlenir (bkz. CLAUDE.md 1.3.3).
 */
export async function getMatchCalculations(
  fixtureId: string,
): Promise<Result<MatchCalculations, CheckmatchCoreError>> {
  const rawResult = await checkmatchCoreRequest(
    `/api/v1/matches/${encodeURIComponent(fixtureId)}/calculations`,
  );
  if (!rawResult.ok) return rawResult;

  const parsed = checkmatchMatchCalculationsRawSchema.safeParse(rawResult.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: `Mac sunucusu yanıtı beklenen şemaya uymuyor: ${parsed.error.message}`,
      },
    };
  }

  return { ok: true, data: mapCheckmatchCalculationsToMatchCalculations(parsed.data) };
}
