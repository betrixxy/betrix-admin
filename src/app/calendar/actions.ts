"use server";

import { getMatchCalculations } from "@/lib/services/checkmatch-core";
import type { CheckmatchCoreError } from "@/lib/services/checkmatch-core";
import type { MatchCalculations } from "@/types/market";
import type { Result } from "@/types/result";

/**
 * checkmatch-core servis katmanına ince bir Server Action köprüsü — client bileşenler
 * (bkz. market-calculations-panel.tsx) servis fonksiyonunu doğrudan değil, bunun
 * üzerinden çağırır (bkz. CLAUDE.md 1.5 — route handler/server action ince kalır).
 */
export async function getMatchCalculationsAction(
  fixtureId: string,
): Promise<Result<MatchCalculations, CheckmatchCoreError>> {
  return getMatchCalculations(fixtureId);
}
