import { sportmonksRequest } from "@/lib/services/sportmonks/client";
import { mapSportmonksTeamToForm } from "@/lib/services/sportmonks/mappers";
import { sportmonksTeamResponseSchema } from "@/lib/services/sportmonks/types";
import type { SportmonksError } from "@/lib/services/sportmonks/types";
import type { Result } from "@/types/result";
import type { TeamForm } from "@/types/sports";

export interface MatchTeamForm {
  home: TeamForm;
  away: TeamForm;
}

async function getTeamForm(
  sportmonksTeamId: number,
): Promise<Result<TeamForm, SportmonksError>> {
  const rawResult = await sportmonksRequest(`/teams/${sportmonksTeamId}`, {
    include: "latest;statistics",
  });
  if (!rawResult.ok) return rawResult;

  const parsed = sportmonksTeamResponseSchema.safeParse(rawResult.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: `Sportmonks yanıtı beklenen şemaya uymuyor: ${parsed.error.message}`,
      },
    };
  }

  return { ok: true, data: mapSportmonksTeamToForm(parsed.data.data) };
}

/**
 * Seçilen bir maçın iki takımının form durumunu ve gol atma/yeme oranlarını çeker (bkz.
 * CLAUDE.md 2.2 `TeamForm`, 2.3 — Stüdyo'nun 'Yapay Zeka Tahmini' / 'Takım Analizi'
 * şablonlarında arka planda kullanılacak). Takım kimlikleri Sportmonks sayısal team ID'si
 * olmalıdır (bkz. `Fixture.providerIds.sportmonks`).
 */
export async function getTeamFormForFixture(
  homeTeamId: number,
  awayTeamId: number,
): Promise<Result<MatchTeamForm, SportmonksError>> {
  const [homeResult, awayResult] = await Promise.all([
    getTeamForm(homeTeamId),
    getTeamForm(awayTeamId),
  ]);

  if (!homeResult.ok) return homeResult;
  if (!awayResult.ok) return awayResult;

  return { ok: true, data: { home: homeResult.data, away: awayResult.data } };
}
