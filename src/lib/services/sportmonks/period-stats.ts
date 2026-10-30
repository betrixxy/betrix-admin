import { findSportmonksFixture, type SportmonksFixtureQuery } from "@/lib/services/sportmonks/advanced-stats";
import { isSportmonksConfigured, sportmonksRequest } from "@/lib/services/sportmonks/client";
import { sportmonksHalfRows, sportmonksPeriodFixtureResponseSchema } from "@/lib/services/sportmonks/period-stats-mappers";
import type { HalfRow } from "@/types/match-analysis";

/**
 * Maç Analizi 02'nin YEDEK kaynağı: aynı maçın Sportmonks dönem istatistiği. Yalnızca API-Football devre
 * verisi yetersizse çağrılır (bkz. `match-analysis/halves.ts` — tek kaynak kuralı). Eşleme sağlayıcının özgün
 * takım adlarıyla (`findSportmonksFixture`). Anahtar yoksa, maç eşleşmezse ya da istek düşerse `null`.
 * ~3 istek, önbellekli.
 */
export async function getSportmonksHalfRows(fixture: SportmonksFixtureQuery): Promise<HalfRow[] | null> {
  if (!isSportmonksConfigured()) return null;
  const found = await findSportmonksFixture(fixture);
  if (!found) return null;
  const result = await sportmonksRequest(`/fixtures/${found.match.id}`, { include: "periods.statistics.type" });
  if (!result.ok) return null;
  const parsed = sportmonksPeriodFixtureResponseSchema.safeParse(result.data);
  return parsed.success ? sportmonksHalfRows(parsed.data.data.periods, { home: found.home, away: found.away }) : null;
}
