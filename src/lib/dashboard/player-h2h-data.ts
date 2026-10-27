import { domesticLeague } from "@/lib/archive/structure";
import { nameOrigin, originFromCountry } from "@/lib/dashboard/name-case";
import { teamNameTr } from "@/lib/dashboard/match-result-labels";
import { fullNameFromApi, leagueDisplay, seasonLabel, shortNameOf } from "@/lib/player-h2h/names";
import { positionFromApi } from "@/lib/player-h2h/stats";
import { getFixturePlayers, getTeamFinishedFixtures } from "@/lib/services/api-football/player-recency";
import { missingAppearances, playerAppearances } from "@/lib/services/api-football/player-recency-mappers";
import { getPlayerSeason } from "@/lib/services/api-football/player-season";
import { aggregateSeason, type SeasonAggregate } from "@/lib/services/api-football/player-season-mappers";
import type { ApiFootballPlayerSeasonEntry } from "@/lib/services/api-football/player-season-types";
import { getTeamCurrentLeagues, getTeamInfo } from "@/lib/services/api-football/team-directory";
import { isSportmonksConfigured } from "@/lib/services/sportmonks";
import { getSportmonksPlayerRecords } from "@/lib/services/sportmonks/player-season";
import { sameSample, sportmonksSeasonValues } from "@/lib/services/sportmonks/player-season-mappers";
import type { H2HFreshness, H2HScope, H2HStatKey, PlayerSeasonStats } from "@/types/player-h2h";
import type { Result } from "@/types/result";

/**
 * Oyuncu karşılaştırmasının verisi (yalnızca okuma). Kaynaklar SATIR BAZINDA KARIŞMAZ (kurucu kararı,
 * 2026-10-27):
 *  1. API-Football sezon toplamı + toplama henüz girmemiş bitmiş maçlar (aynı sağlayıcının maç bazlı
 *     oyuncu istatistiği; eksikler toplamdaki maç sayısı ile süre alınan maç listesi karşılaştırılarak
 *     bulunur, bkz. `player-recency-mappers.ts`).
 *  2. Bu yapılamazsa (maç verisi eksik/alınamadı) o oyuncu için BÜTÜN satırlar Sportmonks'tan; orada
 *     olmayan istatistik düşer. İkisi de yoksa kart üretilmez.
 *  Tek istisna: API-Football'da HİÇ olmayan xG / büyük fırsat / xA, iki kaynağın maç ve dakikası birebir
 *  tutuyorsa Sportmonks'tan gelir (dipnotta yazılır); tutmuyorsa satır düşer.
 * Sezon = oyuncunun takımının yurt içi liginin güncel sezonu. Eksik veri 0 yazılmaz.
 */

export interface PlayerSeasonRequest {
  playerId: number;
  /** Oyuncunun güncel takımı (arşiv `Person.currentTeamId` ya da maçtaki takım). */
  teamId: number;
  scope: H2HScope;
  /** Arşivin resmi adı (admin düzeltmesi dahil); verilmezse API adı. */
  fullName?: string | null;
  /** Bu andan önce bitmiş maçlar (varsayılan şimdi). */
  now?: Date;
}

/** API-Football'da olmayan, yalnızca Sportmonks'ta bulunan istatistikler. */
const SPORTMONKS_ONLY: readonly H2HStatKey[] = ["xg", "bigChancesCreated", "xa"];

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

interface Current {
  aggregate: SeasonAggregate;
  values: PlayerSeasonStats["values"];
  sources: PlayerSeasonStats["sources"];
  freshness: H2HFreshness;
}

const allFrom = (values: PlayerSeasonStats["values"], source: "api-football" | "sportmonks"): PlayerSeasonStats["sources"] =>
  Object.fromEntries(Object.keys(values).map((key) => [key as H2HStatKey, source]));

/** 1. yol: sezon toplamı + eksik maçlar (API-Football). Yapılamazsa sebep. */
async function apiFootballCurrent(entries: ApiFootballPlayerSeasonEntry[], request: PlayerSeasonRequest, season: number, leagueId: number | null, domesticId: number, team: { id: number; name: string }, beforeMs: number): Promise<Result<Current>> {
  const seasonAggregate = aggregateSeason(entries, () => true);
  const list = await getTeamFinishedFixtures(team.id, season, leagueId);
  if (!list.ok) return fail(list.error.code, `Maç listesi alınamadı: ${list.error.message}`);
  // Tüm turnuvalar: yalnızca sezon toplamında olan turnuvalar (hazırlık maçları toplamda yok).
  const leagues = new Set([domesticId, ...entries.map((entry) => entry.league.id)]);
  const finished = list.data.filter((fixture) => fixture.fixture.timestamp * 1000 < beforeMs && leagues.has(fixture.league.id));
  const details = await getFixturePlayers(finished.map((fixture) => fixture.fixture.id));
  if (!details.ok) return fail(details.error.code, `Maç bazlı veri alınamadı: ${details.error.message}`);
  const missing = missingAppearances(seasonAggregate.appearances, playerAppearances(details.data, request.playerId, team));
  if (!missing.ok) return missing;
  const aggregate = aggregateSeason([...entries, ...missing.data.map((appearance) => appearance.entry)], () => true);
  const last = finished.at(-1);
  return {
    ok: true,
    data: {
      aggregate: { ...aggregate, position: seasonAggregate.position ?? aggregate.position, competitions: seasonAggregate.competitions },
      values: aggregate.values,
      sources: allFrom(aggregate.values, "api-football"),
      freshness: { source: "api-football", asOfUtc: last ? new Date(last.fixture.timestamp * 1000).toISOString() : null, addedMatches: missing.data.length, note: null },
    },
  };
}

export async function loadPlayerSeasonStats(request: PlayerSeasonRequest): Promise<Result<PlayerSeasonStats>> {
  const beforeMs = (request.now ?? new Date()).getTime();
  const [info, leagues] = await Promise.all([getTeamInfo(request.teamId), getTeamCurrentLeagues(request.teamId)]);
  if (!info.ok) return fail(info.error.code, info.error.message);
  if (!leagues.ok) return fail(leagues.error.code, leagues.error.message);
  const domestic = domesticLeague(leagues.data, info.data?.country ?? null);
  if (!domestic || domestic.season === null) return fail("NO_LEAGUE", `Takım ${request.teamId} için bu sezonun yurt içi ligi bulunamadı.`);
  const season = domestic.season;

  const raw = await getPlayerSeason(request.playerId, season);
  if (!raw.ok) return fail(raw.error.code, raw.error.message);
  const { player, statistics } = raw.data;
  const inScope = (entry: (typeof statistics)[number]) => entry.team.id === request.teamId && entry.league.season === season && (request.scope === "ALL" || entry.league.id === domestic.id);
  const entries = statistics.filter((entry) => inScope(entry) && (entry.games.minutes ?? 0) > 0);
  const fullName = request.fullName?.trim() || fullNameFromApi(player.name, player.firstname);
  const shortName = shortNameOf(fullName);
  const teamEntry = statistics.find(inScope);
  const team = { id: request.teamId, name: teamEntry?.team.name ?? info.data?.name ?? "", logo: teamEntry?.team.logo ?? info.data?.logo ?? null };

  const smScope = { season, calendarYear: domestic.calendarYear, teamName: team.name, leagueName: request.scope === "LEAGUE" ? domestic.name : null };
  const records = isSportmonksConfigured() ? await getSportmonksPlayerRecords(fullName, shortName, smScope) : null;
  const sm = records ? sportmonksSeasonValues(records.records) : null;

  let current = await apiFootballCurrent(entries, request, season, request.scope === "LEAGUE" ? domestic.id : null, domestic.id, team, beforeMs);
  if (!current.ok) {
    // 2. yol: bütün satırlar Sportmonks'tan (karışım yok).
    const reason = current.error.message;
    if (!sm) return fail("NO_CURRENT_DATA", `${fullName}: güncel veri yok — ${reason}; Sportmonks'ta da kapsamda kayıt yok.`);
    if (!sm.minutes) return fail("NO_CURRENT_DATA", `${fullName}: güncel veri yok — ${reason}; Sportmonks kaydında dakika yok.`);
    const list = await getTeamFinishedFixtures(team.id, season, request.scope === "LEAGUE" ? domestic.id : null);
    const last = list.ok ? list.data.filter((fixture) => fixture.fixture.timestamp * 1000 < beforeMs).at(-1) : undefined;
    current = {
      ok: true,
      data: {
        aggregate: { appearances: sm.appearances ?? 0, minutes: sm.minutes, values: sm.values, penaltyGoals: sm.penaltyGoals ?? null, position: aggregateSeason(entries, () => true).position, competitions: entries.map((e) => ({ id: e.league.id, name: e.league.name })) },
        values: sm.values,
        sources: allFrom(sm.values, "sportmonks"),
        freshness: { source: "sportmonks", asOfUtc: last ? new Date(last.fixture.timestamp * 1000).toISOString() : null, addedMatches: 0, note: `Sportmonks kullanıldı: ${reason}` },
      },
    };
  }
  const { aggregate, values, sources, freshness } = current.data;
  // Koşullu Sportmonks (2026-10-27): API-Football'da hiç olmayan xG/büyük fırsat/xA, iki kaynak AYNI
  // örneklemi (maç ve dakika birebir) gösteriyorsa Sportmonks'tan; değilse satır düşer.
  if (freshness.source === "api-football" && sm && sameSample(sm, aggregate)) {
    for (const key of SPORTMONKS_ONLY) {
      const value = sm.values[key];
      if (value === undefined || values[key] !== undefined) continue;
      values[key] = value;
      sources[key] = "sportmonks";
    }
  }
  const scopeText = request.scope === "LEAGUE" ? domestic.name : "tüm turnuvalar";
  if (aggregate.minutes <= 0) return fail("NO_MINUTES", `${fullName} bu sezon ${scopeText} kapsamında forma giymedi.`);
  const position = positionFromApi(aggregate.position);
  if (!position) return fail("NO_POSITION", `${fullName} için mevki bilinmiyor.`);

  return {
    ok: true,
    data: {
      playerId: player.id,
      fullName,
      shortName,
      nameOrigin: nameOrigin(fullName) ?? originFromCountry(player.nationality),
      teamId: team.id,
      teamName: teamNameTr(team.name),
      teamOrigin: originFromCountry(info.data?.country),
      teamLogo: team.logo,
      position,
      season,
      seasonLabel: seasonLabel(season, domestic.calendarYear),
      scope: request.scope,
      league: leagueDisplay(domestic.id, domestic.name, domestic.country),
      competitions: aggregate.competitions,
      appearances: aggregate.appearances,
      minutes: aggregate.minutes,
      values,
      sources,
      penaltyGoals: aggregate.penaltyGoals,
      freshness,
    },
  };
}
