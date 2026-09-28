"use server";

import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { getMatchCalculations } from "@/lib/services/checkmatch-core";
import type { CheckmatchCoreError } from "@/lib/services/checkmatch-core";
import type { MatchCalculations } from "@/types/market";
import type { Result } from "@/types/result";

/**
 * checkmatch-core servis katmanına ince bir Server Action köprüsü — client bileşenler
 * (bkz. market-calculations-panel.tsx) servis fonksiyonunu doğrudan değil, bunun
 * üzerinden çağırır (bkz. CLAUDE.md 1.5 — route handler/server action ince kalır).
 *
 * Server Action'lar herkese açık POST uç noktalarıdır; `proxy.ts` yalnızca sayfa
 * isteklerini korur. VIP token'lı Mac sunucusu çağrısı bu yüzden oturumu burada doğrular.
 */
export async function getMatchCalculationsAction(
  fixtureId: string,
): Promise<Result<MatchCalculations, CheckmatchCoreError>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  return getMatchCalculations(fixtureId);
}
