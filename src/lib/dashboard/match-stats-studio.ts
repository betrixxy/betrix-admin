import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { getSportmonksMatchValues } from "@/lib/services/sportmonks";
import type { MatchStatsFacts } from "@/types/match-stats";

/**
 * Maç İstatistikleri verisi: API-Football bitmiş maç yanıtı (skor, golcüler, istatistik — set
 * kartlarıyla tek kaynak) + Sportmonks'un yalnızca API-Football'un boş bıraktığı satırları
 * (bkz. CLAUDE.md 2.1). Sportmonks eşleşmezse ya da düşerse kart API-Football satırlarıyla devam
 * eder. Eşleme sağlayıcının özgün takım adlarıyla yapılır (Türkçe eşlenmiş ad değil).
 * Bitmemiş maçta null — doğrulama `validateMatchResultFixture` ile çağıran tarafta yapılır.
 */
export async function loadMatchStatsFacts(raw: ApiFootballFixtureResultRaw): Promise<MatchStatsFacts | null> {
  const sportmonks = await getSportmonksMatchValues({
    kickoffUtc: raw.fixture.date,
    homeTeam: { name: raw.teams.home.name },
    awayTeam: { name: raw.teams.away.name },
  }).catch((error: unknown) => {
    console.error("[match-stats] Sportmonks eşlemesi düştü:", error);
    return null;
  });
  return toMatchStatsFacts(raw, sportmonks);
}
