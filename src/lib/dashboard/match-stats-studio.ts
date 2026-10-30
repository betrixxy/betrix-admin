import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { getSportmonksMatchValues } from "@/lib/services/sportmonks";
import { withSetPeople } from "@/lib/dashboard/set-people";
import { warmTeamColors } from "@/lib/dashboard/team-colors";
import { withTeamOrigins } from "@/lib/dashboard/team-origin";
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
  // Takım rengi ortak kaynaktan (tablo dışı takım: logodan otomatik) — 02 renkleri kartta okunur.
  await warmTeamColors([{ id: raw.teams.home.id, name: raw.teams.home.name, logoUrl: raw.teams.home.logo }, { id: raw.teams.away.id, name: raw.teams.away.name, logoUrl: raw.teams.away.logo }]);
  const facts = toMatchStatsFacts(raw, sportmonks);
  // Ad büyük harfi için takım kökeni (Türk takımı mı) — bkz. team-origin.ts.
  return facts ? withSetPeople(await withTeamOrigins(facts)) : null;
}
