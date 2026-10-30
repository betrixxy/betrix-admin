import { assembleMatchAnalysisFacts } from "@/lib/match-analysis/assemble";
import { apiFootballSuffices, chooseHalves } from "@/lib/match-analysis/halves";
import { eventPlayerIds, withEventNames, type MatchPeople } from "@/lib/match-analysis/names";
import { apiFootballHalfRows } from "@/lib/services/api-football/half-stats-mappers";
import { getHalfStatisticsRaw } from "@/lib/services/api-football/half-stats";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { getSportmonksHalfRows } from "@/lib/services/sportmonks/period-stats";
import type { HalfRow, HalvesOutcome, MatchAnalysisFacts } from "@/types/match-analysis";
import type { ResultTeam } from "@/types/match-result";

/**
 * Maç Analizi verisinin yükleyicisi (yalnızca okuma): bitmiş maç yanıtı (çağıran `/fixtures?id=` ile verir —
 * Maç Sonucu ile aynı istek) + devre verisi TEK kaynaktan (API-Football yeterliyse Sportmonks'a hiç gidilmez)
 * + kart kişi adları. Kişi adları ve takım kökeni DIŞARIDAN verilir (`deps`): üretimde arşiv düzeltmeli
 * `person-directory.ts::teamPeople` + `team-origin.ts::withTeamOrigins`, offline araçta veritabanısız Sportmonks
 * kadrosu — bu dosya veritabanına dokunmaz. Bitmemiş maçta null.
 */

export interface AnalysisDeps {
  /** Takımın ad kaynakları (`ids`: olaylardaki oyuncu kimlikleri, arşiv düzeltmesi için). */
  teamPeople(team: ResultTeam, ids: readonly number[]): Promise<MatchPeople["home"]>;
  /** İki takıma büyük harf kökeni ekler. */
  withOrigins<T extends { home: ResultTeam; away: ResultTeam }>(match: T): Promise<T>;
}

/** Devre verisi: önce API-Football, yetmezse Sportmonks (satır karışımı yok — `chooseHalves`). */
export async function loadHalves(raw: ApiFootballFixtureResultRaw): Promise<HalvesOutcome> {
  const ids = { home: raw.teams.home.id, away: raw.teams.away.id };
  const response = await getHalfStatisticsRaw(raw.fixture.id);
  if (!response.ok) console.error("[match-analysis] API-Football devre istatistiği okunamadı:", response.error.code, response.error.message);
  const apiFootball: HalfRow[] | null = response.ok ? apiFootballHalfRows(response.data, ids) : null;
  if (apiFootballSuffices(apiFootball)) return chooseHalves(apiFootball, null, false);
  const sportmonks = await getSportmonksHalfRows({ kickoffUtc: raw.fixture.date, homeTeam: { name: raw.teams.home.name }, awayTeam: { name: raw.teams.away.name } }).catch((error: unknown) => {
    console.error("[match-analysis] Sportmonks dönem istatistiği düştü:", error);
    return null;
  });
  return chooseHalves(apiFootball, sportmonks);
}

export async function loadMatchAnalysisFacts(raw: ApiFootballFixtureResultRaw, deps: AnalysisDeps): Promise<MatchAnalysisFacts | null> {
  const assembled = assembleMatchAnalysisFacts(raw, await loadHalves(raw));
  if (!assembled) return null;
  const match = await deps.withOrigins(assembled.match);
  const ids = eventPlayerIds(assembled);
  const [home, away] = await Promise.all([deps.teamPeople(match.home, ids), deps.teamPeople(match.away, ids)]);
  return withEventNames({ ...assembled, match }, { home, away });
}
