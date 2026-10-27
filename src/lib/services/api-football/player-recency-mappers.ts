import type { ApiFootballFixturePlayers, ApiFootballFixturePlayerStat, ApiFootballPlayerSeasonEntry } from "@/lib/services/api-football/player-season-types";
import type { Result } from "@/types/result";

/**
 * Sezon toplamının güncelliği — saf. API-Football'un oyuncu sezon toplamı son maçları geç işler (26 Ekim
 * maçları 27 Ekim'de hâlâ yoktu). Eksik maçlar şöyle bulunur: oyuncunun kapsamdaki bitmiş maçlarda süre
 * aldığı maçlar kronolojik sıralanır; toplamdaki maç sayısı N ise ilk N maç toplamda, kalanlar eksiktir
 * (toplam en eski maçlardan başlar, geride kalan uçtur). Eksikler maç bazlı istatistikten sezon kaydı
 * biçimine çevrilip toplama eklenir — kaynak yine API-Football, satır bazında karışım yok.
 */

export interface PlayerAppearance {
  fixtureId: number;
  timestamp: number;
  /** Sezon kaydı biçiminde tek maç (toplama eklenir). */
  entry: ApiFootballPlayerSeasonEntry;
}

const num = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Maç istatistiği → sezon kaydı biçimi. Pas isabeti sayıdan yüzdeye çevrilir. */
export function fixtureEntry(stat: ApiFootballFixturePlayerStat, fixture: Pick<ApiFootballFixturePlayers, "league">, team: { id: number; name: string }): ApiFootballPlayerSeasonEntry {
  const passes = stat.passes?.total ?? null;
  const accurate = num(stat.passes?.accuracy);
  return {
    team,
    league: { id: fixture.league.id, name: fixture.league.name, season: fixture.league.season ?? null },
    games: { appearences: 1, minutes: stat.games?.minutes ?? null, position: null, rating: stat.games?.rating ?? null },
    shots: { total: stat.shots?.total ?? null, on: stat.shots?.on ?? null },
    goals: { total: stat.goals?.total ?? null, assists: stat.goals?.assists ?? null, saves: stat.goals?.saves ?? null },
    passes: { total: passes, key: stat.passes?.key ?? null, accuracy: passes !== null && passes > 0 && accurate !== null ? (accurate / passes) * 100 : null },
    tackles: { total: stat.tackles?.total ?? null, interceptions: stat.tackles?.interceptions ?? null },
    duels: { total: stat.duels?.total ?? null, won: stat.duels?.won ?? null },
    dribbles: { attempts: stat.dribbles?.attempts ?? null, success: stat.dribbles?.success ?? null },
    penalty: { scored: stat.penalty?.scored ?? null },
  };
}

/** Oyuncunun süre aldığı maçlar (dakika > 0), eskiden yeniye. */
export function playerAppearances(fixtures: ApiFootballFixturePlayers[], playerId: number, team: { id: number; name: string }): PlayerAppearance[] {
  const appearances: PlayerAppearance[] = [];
  for (const fixture of fixtures) {
    const stat = fixture.players.find((side) => side.team.id === team.id)?.players.find((row) => row.player.id === playerId)?.statistics[0];
    if (!stat || (stat.games?.minutes ?? 0) <= 0) continue;
    appearances.push({ fixtureId: fixture.fixture.id, timestamp: fixture.fixture.timestamp, entry: fixtureEntry(stat, fixture, team) });
  }
  return appearances.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Toplama girmemiş maçlar: toplamdaki maç sayısından sonraki süre alınan maçlar. Maç listesi toplamdan
 * KISA ise (maç verisi eksik) eşleştirme yapılamaz — çağıran Sportmonks'a geçer.
 */
export function missingAppearances(seasonAppearances: number, appearances: PlayerAppearance[]): Result<PlayerAppearance[]> {
  if (appearances.length < seasonAppearances) {
    return { ok: false, error: { code: "FIXTURE_DATA_MISSING", message: `Maç bazlı veri eksik: sezon toplamında ${seasonAppearances} maç, maç listesinde ${appearances.length}.` } };
  }
  return { ok: true, data: appearances.slice(seasonAppearances) };
}
