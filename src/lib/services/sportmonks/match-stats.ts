import { findSportmonksFixture, type SportmonksFixtureQuery } from "@/lib/services/sportmonks/advanced-stats";
import { isSportmonksConfigured } from "@/lib/services/sportmonks/client";
import { sportmonksMatchValues, type SportmonksMatchValues } from "@/lib/services/sportmonks/match-stats-mappers";

/**
 * Maç İstatistikleri zenginleştirmesi: aynı maçın Sportmonks istatistikleri (büyük fırsat,
 * direkten dönen ve API-Football'un boş bıraktığı satırlar). Anahtar yoksa, maç eşleşmezse ya da
 * istek düşerse `null` — kart yalnızca API-Football satırlarıyla devam eder. ~2 istek, önbellekli.
 */
export async function getSportmonksMatchValues(fixture: SportmonksFixtureQuery): Promise<SportmonksMatchValues | null> {
  if (!isSportmonksConfigured()) return null;
  const found = await findSportmonksFixture(fixture, "statistics.type;participants");
  return found ? sportmonksMatchValues(found.match, found) : null;
}
