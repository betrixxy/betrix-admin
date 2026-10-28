import { drawSetupForLeague, type DrawCompetitionId } from "@/lib/draw/rounds";
import { getFixtureDetailsByIds } from "@/lib/services/api-football/fixtures";
import { parseFixtureId } from "@/lib/services/api-football/mappers";
import type { Result } from "@/types/result";

const FIXTURE_TTL_MS = 60 * 60 * 1000;

/** Maçtan açılan kura stüdyosu: maçın turnuvası kura turnuvasıysa `setup` dolu, değilse yalnızca lig adı. */
export interface DrawFixtureEntry {
  leagueName: string;
  setup: { competitionId: DrawCompetitionId; season: number } | null;
}

/** `?fixtureId=api-football-<id>` → maçın ligi ve sezonu (tek API okuması, 1 saat önbellek). */
export async function drawEntryFromFixture(fixtureId: string): Promise<Result<DrawFixtureEntry>> {
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_FIXTURE", message: "Geçersiz maç kimliği." } };
  const result = await getFixtureDetailsByIds([apiId], { ttlMs: FIXTURE_TTL_MS });
  if (!result.ok) return { ok: false, error: { code: result.error.code, message: result.error.message } };
  const raw = result.data[0];
  if (!raw) return { ok: false, error: { code: "NOT_FOUND", message: "Maç API-Football'da bulunamadı." } };
  return { ok: true, data: { leagueName: raw.league.name, setup: drawSetupForLeague(raw.league) } };
}
