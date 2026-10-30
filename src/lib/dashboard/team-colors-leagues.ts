import { extractLeagueTeamColors, type LeagueColorReport, type LeagueTeamSource } from "@/lib/dashboard/team-color-warm";
import { prismaTeamColorStore } from "@/lib/dashboard/team-colors";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";
import { getLeagueCurrentSeason, getLeagueTeams } from "@/lib/services/api-football/squads";

/**
 * "Bütün liglerin takım renklerini çıkar" (Ad Raporu, 2026-10-31) — YALNIZCA admin tıklamasıyla (zamanlayıcı
 * yok, 1.10). Kapsanan 10 ligin güncel sezon takımları (API-Football `/leagues?current` + `/teams?league&season`,
 * yalnızca okuma) → logodan renk → AUTO kayıt → "Otomatik renkler" onay listesi. Kod tablosundaki ve kaydı olan
 * takıma dokunulmaz (onaylı kayıt asla ezilmez). Ücretli çağrı yok (Fal/Anthropic yok; logolar sağlayıcıdan).
 */

const apiFootballLeagueTeams: LeagueTeamSource = {
  async season(leagueId) {
    const season = await getLeagueCurrentSeason(leagueId);
    return season.ok ? season.data.season : null;
  },
  async teams(leagueId, season) {
    const teams = await getLeagueTeams(leagueId, season);
    return teams.ok ? teams.data.map((team) => ({ id: team.id, name: team.name, logoUrl: team.logoUrl })) : null;
  },
};

export function extractAllLeagueTeamColors(): Promise<LeagueColorReport> {
  const names = new Map(SUPPORTED_LEAGUES.map((league) => [league.apiFootballId, league.name]));
  return extractLeagueTeamColors(
    SUPPORTED_LEAGUES.map((league) => league.apiFootballId),
    apiFootballLeagueTeams,
    prismaTeamColorStore,
    (step) => reportJobStep(step.kind === "league" ? `${names.get(step.leagueId) ?? step.leagueId} takımları okunuyor` : `${step.teams} takımın logosundan renk çıkarılıyor`),
  );
}

/** Admin'e tek satır özet. */
export function leagueColorNotice(report: LeagueColorReport): string {
  const failed = report.failedLeagues.length > 0 ? ` · okunamayan lig: ${report.failedLeagues.length}` : "";
  return `${report.teams} takım: ${report.created} yeni otomatik renk (onay bekliyor), ${report.existing} zaten kayıtlı, ${report.table} kulüp tablosunda, ${report.noColor} renk çıkmadı${failed}.`;
}
