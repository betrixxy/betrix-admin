import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_SERVER_LEAGUES } from "@/lib/media-server/leagues";
import {
  getLeagueCurrentSeason,
  getLeagueTeams,
  getPlayerProfile,
  getTeamSeasonPlayers,
  getTeamSquad,
} from "@/lib/services/api-football";
import type { ApiFootballError } from "@/lib/services/api-football";
import type { ApiFootballPlayerProfileRaw } from "@/lib/services/api-football/types";
import type { MediaApiPlayer, MediaApiTeam } from "@/types/media-server";
import type { Result } from "@/types/result";

/**
 * Kapsamdaki 44 ligin takım + oyuncu havuzunu API-Football'dan toplar. Her yanıt diskte
 * önbelleklenir (`storage/media-server-cache/`) — yarıda kesilen ya da tekrar edilen bir
 * çalıştırma kotayı yeniden harcamaz. Herhangi bir istek başarısız olursa havuz eksik
 * kabul edilir ve script kopyalamaya geçmeden durur.
 */

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TEAM_CONCURRENCY = 6;

export interface ApiPool {
  teams: MediaApiTeam[];
  players: MediaApiPlayer[];
  failures: string[];
}

class DiskCache {
  constructor(private readonly dir: string, private readonly refresh: boolean) {}

  async get<T>(key: string, load: () => Promise<Result<T, ApiFootballError>>): Promise<Result<T, ApiFootballError>> {
    const file = path.join(this.dir, `${key}.json`);
    if (!this.refresh) {
      const info = await stat(file).catch(() => null);
      if (info && Date.now() - info.mtimeMs < CACHE_MAX_AGE_MS) {
        return { ok: true, data: JSON.parse(await readFile(file, "utf8")) as T };
      }
    }
    const result = await load();
    if (result.ok) {
      await mkdir(this.dir, { recursive: true });
      await writeFile(file, JSON.stringify(result.data));
    }
    return result;
  }
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        const item = items[index];
        if (item !== undefined) await worker(item, index);
      }
    }),
  );
}

/** Birden fazla kaynaktan gelen aynı oyuncuyu birleştirir; çelişen doğum tarihi → null. */
class PlayerMerger {
  private readonly players = new Map<number, MediaApiPlayer>();
  private readonly dobConflicts = new Set<number>();

  addProfile(raw: ApiFootballPlayerProfileRaw, teamId: number | null): void {
    const existing = this.players.get(raw.id);
    const birthDate = raw.birth?.date ?? null;
    if (!existing) {
      this.players.set(raw.id, {
        id: raw.id,
        name: raw.name ?? `${raw.firstname ?? ""} ${raw.lastname ?? ""}`.trim(),
        firstname: raw.firstname,
        lastname: raw.lastname,
        birthDate,
        teamIds: teamId !== null ? [teamId] : [],
        number: null,
      });
      return;
    }
    if (teamId !== null && !existing.teamIds.includes(teamId)) existing.teamIds.push(teamId);
    existing.firstname ??= raw.firstname;
    existing.lastname ??= raw.lastname;
    if (birthDate && existing.birthDate && birthDate !== existing.birthDate) this.dobConflicts.add(raw.id);
    existing.birthDate ??= birthDate;
  }

  addSquadEntry(id: number, name: string | null, teamId: number, number: number | null): void {
    const existing = this.players.get(id);
    if (!existing) {
      this.players.set(id, { id, name: name ?? "", firstname: null, lastname: null, birthDate: null, teamIds: [teamId], number });
      return;
    }
    if (!existing.teamIds.includes(teamId)) existing.teamIds.push(teamId);
    existing.number ??= number;
  }

  missingBirthDate(): number[] {
    return [...this.players.values()].filter((p) => p.birthDate === null).map((p) => p.id);
  }

  result(): MediaApiPlayer[] {
    return [...this.players.values()].map((p) => (this.dobConflicts.has(p.id) ? { ...p, birthDate: null } : p));
  }
}

export async function collectApiPool(cacheDir: string, refresh: boolean, log: (line: string) => void): Promise<ApiPool> {
  const cache = new DiskCache(cacheDir, refresh);
  const failures: string[] = [];
  const teams = new Map<number, MediaApiTeam>();
  const teamSeasons = new Map<number, number>();

  for (const league of MEDIA_SERVER_LEAGUES) {
    const season = await cache.get(`league-${league.apiFootballId}`, () => getLeagueCurrentSeason(league.apiFootballId));
    if (!season.ok) {
      failures.push(`Lig ${league.apiFootballId} (${league.label}): ${season.error.message}`);
      continue;
    }
    const { season: year, leagueName, country } = season.data;
    const leagueTeams = await cache.get(`teams-${league.apiFootballId}-${year}`, () => getLeagueTeams(league.apiFootballId, year));
    if (!leagueTeams.ok) {
      failures.push(`Lig ${league.apiFootballId} takımları: ${leagueTeams.error.message}`);
      continue;
    }
    log(`  ✓ [${league.apiFootballId}] ${leagueName} (${country ?? "-"}) ${year} — ${leagueTeams.data.length} takım`);
    for (const team of leagueTeams.data) {
      const existing = teams.get(team.id);
      if (existing) existing.leagueIds.push(league.apiFootballId);
      else teams.set(team.id, { ...team, leagueIds: [league.apiFootballId] });
      if (!teamSeasons.has(team.id)) teamSeasons.set(team.id, year);
    }
  }

  const merger = new PlayerMerger();
  const teamList = [...teams.values()];
  await runPool(teamList, TEAM_CONCURRENCY, async (team, index) => {
    const season = teamSeasons.get(team.id) ?? 0;
    const seasonPlayers = await cache.get(`players-${team.id}-${season}`, () => getTeamSeasonPlayers(team.id, season));
    if (seasonPlayers.ok) seasonPlayers.data.forEach((p) => merger.addProfile(p, team.id));
    else failures.push(`Takım ${team.id} (${team.name}) oyuncuları: ${seasonPlayers.error.message}`);

    const squad = await cache.get(`squad-${team.id}`, () => getTeamSquad(team.id));
    if (squad.ok) squad.data.forEach((p) => merger.addSquadEntry(p.id, p.name, team.id, p.number));
    else failures.push(`Takım ${team.id} (${team.name}) kadrosu: ${squad.error.message}`);

    if ((index + 1) % 50 === 0) log(`  … ${index + 1}/${teamList.length} takım kadrosu çekildi`);
  });

  const missing = merger.missingBirthDate();
  log(`  Doğum tarihi eksik ${missing.length} kadro oyuncusu için profil çekiliyor…`);
  await runPool(missing, TEAM_CONCURRENCY, async (playerId) => {
    const profile = await cache.get(`profile-${playerId}`, () => getPlayerProfile(playerId));
    if (!profile.ok) failures.push(`Oyuncu ${playerId} profili: ${profile.error.message}`);
    else if (profile.data) merger.addProfile(profile.data, null);
  });

  return { teams: teamList, players: merger.result(), failures };
}
