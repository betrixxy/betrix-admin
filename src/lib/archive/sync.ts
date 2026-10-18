import type { PersonRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getLeagueCurrentSeason, getLeagueTeams, getPlayerProfile, getTeamSeasonPlayers, getTeamSquad } from "@/lib/services/api-football/squads";
import { getTeamCoach, getTeamCurrentLeagues, getTeamInfo } from "@/lib/services/api-football/team-directory";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";
import { NATIONAL_ROOT_ID, officialLeagueName, officialPersonName, officialTeamName } from "./names";
import { clubTeamDecision, domesticLeague, positionFromApi, type ArchivePosition } from "./structure";

/**
 * Fotoğraf arşivi senkronu — API-Football'dan YALNIZCA OKUR, arşiv tablolarına yazar (Fal/yayın
 * çağrısı yok; bkz. CLAUDE.md 1.10). Takım klasörleri boşken de kişi listesi dolu görünsün diye
 * kadro + teknik direktör çekilir. Kapsam: Trendyol Süper Lig ve 1. Lig tam (`syncLeague`), diğer
 * takımlar gerektikçe (`ensureTeam` / `syncTeam`). Bir takım 7 gün içinde tekrar istenmez.
 *
 * Transfer: kadroda BAŞKA takımda görünen kişi otomatik taşınmaz — `pendingTeamId` ("taşınsın mı?").
 * Milli kadro kulübe dokunmaz, yalnızca `nationalTeamId` yazar.
 */

const RESYNC_MS = 7 * 24 * 60 * 60 * 1000;
/** Ağaç sırası: Türk ligleri önce, sonra yabancı ligler (ad sırasıyla), en altta Milli Takımlar. */
const LEAGUE_SORT: Record<number, number> = { 203: 10, 204: 20 };
const FOREIGN_SORT = 50;
const NATIONAL_SORT = 1000;

export interface SyncReport {
  teams: number;
  peopleAdded: number;
  peopleUpdated: number;
  /** "taşınsın mı?" önerileri (kişi adı → yeni takım). */
  suggestions: string[];
  skipped: string[];
}

const emptyReport = (): SyncReport => ({ teams: 0, peopleAdded: 0, peopleUpdated: 0, suggestions: [], skipped: [] });

function merge(into: SyncReport, from: SyncReport): SyncReport {
  into.teams += from.teams;
  into.peopleAdded += from.peopleAdded;
  into.peopleUpdated += from.peopleUpdated;
  into.suggestions.push(...from.suggestions);
  into.skipped.push(...from.skipped);
  return into;
}

async function ensureNationalRoot(): Promise<void> {
  await prisma.league.upsert({
    where: { id: NATIONAL_ROOT_ID },
    create: { id: NATIONAL_ROOT_ID, officialName: officialLeagueName(NATIONAL_ROOT_ID, ""), isNational: true, sortOrder: NATIONAL_SORT },
    update: {},
  });
}

async function upsertLeague(league: { id: number; name: string; country: string | null; logo: string | null }): Promise<void> {
  const data = { officialName: officialLeagueName(league.id, league.name), country: league.country, logoUrl: league.logo, sortOrder: LEAGUE_SORT[league.id] ?? FOREIGN_SORT };
  await prisma.league.upsert({ where: { id: league.id }, create: { id: league.id, ...data }, update: data });
}

/**
 * Takım kaydı (ad, logo, ülke, o sezonun yurt içi ligi). Milli takım "Milli Takımlar" kökünün
 * altına. Lig bilgisi her çağrıda tazelenir: küme düşen/çıkan takım kendiliğinden yeni ligine geçer.
 */
export async function ensureTeam(teamId: number): Promise<Result<{ id: number; national: boolean; leagueId: number | null }, ApiFootballError>> {
  const info = await getTeamInfo(teamId);
  if (!info.ok) return info;
  if (!info.data) return { ok: false, error: { code: "NOT_FOUND", message: `Takım ${teamId} API-Football'da bulunamadı.` } };
  const team = info.data;

  let leagueId: number | null = null;
  if (team.national) {
    await ensureNationalRoot();
    leagueId = NATIONAL_ROOT_ID;
  } else {
    const leagues = await getTeamCurrentLeagues(teamId);
    const domestic = leagues.ok ? domesticLeague(leagues.data, team.country) : null;
    if (domestic) {
      await upsertLeague(domestic);
      leagueId = domestic.id;
    }
  }
  const data = { officialName: officialTeamName(team.id, team.name), apiName: team.name, logoUrl: team.logo, country: team.country, national: team.national, currentLeagueId: leagueId };
  await prisma.team.upsert({ where: { id: team.id }, create: { id: team.id, ...data }, update: data });
  return { ok: true, data: { id: team.id, national: team.national, leagueId } };
}

interface IncomingPerson {
  apiId: number;
  role: PersonRole;
  apiName: string;
  officialName: string;
  position: ArchivePosition | null;
}

/** Kişiyi yazar; kulüp takımı kararı `clubTeamDecision` (otomatik taşıma yok), milli kadro yalnızca `nationalTeamId`. */
async function upsertPerson(person: IncomingPerson, teamId: number, national: boolean, teamName: string, report: SyncReport): Promise<void> {
  const existing = await prisma.person.findUnique({ where: { apiId_role: { apiId: person.apiId, role: person.role } } });
  const base = { apiName: person.apiName, officialName: person.officialName, ...(person.position ? { position: person.position } : {}) };
  if (!existing) {
    await prisma.person.create({ data: { apiId: person.apiId, role: person.role, ...base, ...(national ? { nationalTeamId: teamId } : { currentTeamId: teamId }) } });
    report.peopleAdded += 1;
    return;
  }
  const team = national ? { nationalTeamId: teamId } : (() => {
    const decision = clubTeamDecision(existing.currentTeamId, teamId);
    if (decision.kind === "ASSIGN") return { currentTeamId: decision.teamId };
    if (decision.kind === "SUGGEST") {
      if (existing.pendingTeamId !== decision.teamId) report.suggestions.push(`${existing.nameOverride ?? person.officialName} → ${teamName}`);
      return { pendingTeamId: decision.teamId };
    }
    return {};
  })();
  // Milli kadronun kısaltılmış adı kulüp senkronunun açtığı tam adı ezmez.
  const keepName = national && existing.officialName.length > person.officialName.length;
  await prisma.person.update({ where: { id: existing.id }, data: { ...base, ...(keepName ? { officialName: existing.officialName } : {}), ...team } });
  report.peopleUpdated += 1;
}

/** Kısaltılmış adları açmak için ad/soyad: kulüpte sezon oyuncuları (sayfalı), milli takımda tek tek profil. */
async function givenNames(teamId: number, leagueId: number | null, abbreviated: number[], national: boolean): Promise<Map<number, { firstname: string | null; lastname: string | null }>> {
  const names = new Map<number, { firstname: string | null; lastname: string | null }>();
  if (!national && leagueId !== null) {
    const season = await getLeagueCurrentSeason(leagueId);
    const players = season.ok ? await getTeamSeasonPlayers(teamId, season.data.season) : null;
    for (const player of players?.ok ? players.data : []) names.set(player.id, { firstname: player.firstname, lastname: player.lastname });
  }
  for (const id of abbreviated.filter((playerId) => !names.has(playerId))) {
    const known = await prisma.person.findUnique({ where: { apiId_role: { apiId: id, role: "PLAYER" } }, select: { officialName: true } });
    if (known && !/^\p{Lu}\.\s/u.test(known.officialName)) continue; // kulüp senkronu zaten açmış
    const profile = await getPlayerProfile(id);
    if (profile.ok && profile.data) names.set(id, { firstname: profile.data.firstname, lastname: profile.data.lastname });
  }
  return names;
}

/** Takımın kadrosu + teknik direktörü. `force` olmadan 7 gün içinde tekrar istek atılmaz. */
export async function syncTeam(teamId: number, options: { force?: boolean } = {}): Promise<Result<SyncReport, ApiFootballError>> {
  const report = emptyReport();
  const stored = await prisma.team.findUnique({ where: { id: teamId }, select: { squadSyncedAt: true } });
  if (!options.force && stored?.squadSyncedAt && Date.now() - stored.squadSyncedAt.getTime() < RESYNC_MS) {
    report.skipped.push(`Takım ${teamId}: son 7 günde senkronlandı`);
    return { ok: true, data: report };
  }
  const team = await ensureTeam(teamId);
  if (!team.ok) return team;
  const teamName = (await prisma.team.findUnique({ where: { id: teamId }, select: { officialName: true } }))?.officialName ?? String(teamId);

  const squad = await getTeamSquad(teamId);
  if (!squad.ok) return squad;
  const abbreviated = squad.data.filter((entry) => /^\p{Lu}\.\s/u.test(entry.name ?? "")).map((entry) => entry.id);
  const names = await givenNames(teamId, team.data.leagueId, abbreviated, team.data.national);
  for (const entry of squad.data) {
    const apiName = entry.name?.trim() || String(entry.id);
    const given = names.get(entry.id);
    await upsertPerson(
      { apiId: entry.id, role: "PLAYER", apiName, officialName: officialPersonName(apiName, given?.firstname, given?.lastname), position: positionFromApi(entry.position) },
      teamId,
      team.data.national,
      teamName,
      report,
    );
  }

  const coach = await getTeamCoach(teamId);
  if (coach.ok && coach.data) {
    const apiName = coach.data.name?.trim() || [coach.data.firstname, coach.data.lastname].filter(Boolean).join(" ");
    await upsertPerson(
      { apiId: coach.data.id, role: "COACH", apiName, officialName: officialPersonName(apiName, coach.data.firstname, coach.data.lastname), position: null },
      teamId,
      team.data.national,
      teamName,
      report,
    );
  }

  await prisma.team.update({ where: { id: teamId }, data: { squadSyncedAt: new Date() } });
  report.teams = 1;
  return { ok: true, data: report };
}

/** Ligin bütün takımları (Trendyol Süper Lig 203, Trendyol 1. Lig 204). */
export async function syncLeague(leagueId: number, options: { force?: boolean } = {}): Promise<Result<SyncReport, ApiFootballError>> {
  const season = await getLeagueCurrentSeason(leagueId);
  if (!season.ok) return season;
  const teams = await getLeagueTeams(leagueId, season.data.season);
  if (!teams.ok) return teams;
  const report = emptyReport();
  for (const team of teams.data) {
    const synced = await syncTeam(team.id, options);
    if (synced.ok) merge(report, synced.data);
    else report.skipped.push(`${team.name}: ${synced.error.message}`);
  }
  return { ok: true, data: report };
}
