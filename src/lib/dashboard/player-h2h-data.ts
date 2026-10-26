import { domesticLeague } from "@/lib/archive/structure";
import { nameOrigin, originFromCountry } from "@/lib/dashboard/name-case";
import { teamNameTr } from "@/lib/dashboard/match-result-labels";
import { fullNameFromApi, leagueDisplay, seasonLabel, shortNameOf } from "@/lib/player-h2h/names";
import { positionFromApi } from "@/lib/player-h2h/stats";
import { getPlayerSeason } from "@/lib/services/api-football/player-season";
import { aggregateSeason } from "@/lib/services/api-football/player-season-mappers";
import { getTeamCurrentLeagues, getTeamInfo } from "@/lib/services/api-football/team-directory";
import { isSportmonksConfigured } from "@/lib/services/sportmonks";
import { getSportmonksPlayerRecords } from "@/lib/services/sportmonks/player-season";
import { minutesAgree, sportmonksSeasonValues } from "@/lib/services/sportmonks/player-season-mappers";
import type { H2HScope, H2HStatKey, PlayerSeasonStats } from "@/types/player-h2h";
import type { Result } from "@/types/result";

/**
 * Oyuncu karşılaştırmasının verisi (yalnızca okuma): sezon = oyuncunun takımının yurt içi liginin
 * güncel sezonu. API-Football birincil; boş kalanları Sportmonks doldurur — ancak Sportmonks'un aynı
 * kapsamdaki dakikası API-Football'unkiyle tutuyorsa (yoksa hiç kullanılmaz, notu düşülür). Eksik
 * veri 0 yazılmaz: değer yoksa alan yok, kart o satırı düşürür.
 */

export interface PlayerSeasonRequest {
  playerId: number;
  /** Oyuncunun güncel takımı (arşiv `Person.currentTeamId` ya da maçtaki takım). */
  teamId: number;
  scope: H2HScope;
  /** Arşivin resmi adı (admin düzeltmesi dahil); verilmezse API adı. */
  fullName?: string | null;
}

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

export async function loadPlayerSeasonStats(request: PlayerSeasonRequest): Promise<Result<PlayerSeasonStats>> {
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
  const aggregate = aggregateSeason(statistics, inScope);
  const fullName = request.fullName?.trim() || fullNameFromApi(player.name, player.firstname);
  const shortName = shortNameOf(fullName);
  const scopeText = request.scope === "LEAGUE" ? domestic.name : "tüm turnuvalar";
  if (aggregate.minutes <= 0) return fail("NO_MINUTES", `${fullName} bu sezon ${scopeText} kapsamında forma giymedi.`);
  const position = positionFromApi(aggregate.position);
  if (!position) return fail("NO_POSITION", `${fullName} için mevki bilinmiyor.`);

  const values = { ...aggregate.values };
  const sources: PlayerSeasonStats["sources"] = Object.fromEntries(Object.keys(values).map((key) => [key, "api-football"]));
  let penaltyGoals = aggregate.penaltyGoals;
  let sportmonksNote: string | null = "Sportmonks anahtarı yok";
  const teamEntry = statistics.find(inScope);
  if (isSportmonksConfigured() && teamEntry) {
    const records = await getSportmonksPlayerRecords(fullName, shortName, { season, teamName: teamEntry.team.name, leagueName: request.scope === "LEAGUE" ? domestic.name : null });
    if (!records) sportmonksNote = "Sportmonks'ta bu kapsamda eşleşen oyuncu kaydı yok";
    else {
      const sm = sportmonksSeasonValues(records.records);
      if (!minutesAgree(sm.minutes, aggregate.minutes)) {
        sportmonksNote = `Sportmonks dakikası tutmadı (API-Football ${aggregate.minutes}, Sportmonks ${sm.minutes ?? "yok"}) — kullanılmadı`;
      } else {
        sportmonksNote = null;
        for (const [key, value] of Object.entries(sm.values) as [H2HStatKey, number][]) {
          if (values[key] !== undefined) continue;
          values[key] = value;
          sources[key] = "sportmonks";
        }
        if (penaltyGoals === null && sm.penaltyGoals !== undefined) penaltyGoals = sm.penaltyGoals;
      }
    }
  }

  const team = teamEntry?.team ?? { id: request.teamId, name: info.data?.name ?? "", logo: info.data?.logo ?? null };
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
      teamLogo: team.logo ?? null,
      position,
      season,
      seasonLabel: seasonLabel(season),
      scope: request.scope,
      league: leagueDisplay(domestic.id, domestic.name, domestic.country),
      competitions: aggregate.competitions,
      appearances: aggregate.appearances,
      minutes: aggregate.minutes,
      values,
      sources,
      penaltyGoals,
      sportmonksNote,
    },
  };
}
