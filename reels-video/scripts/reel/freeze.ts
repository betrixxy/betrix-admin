import "./setup-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cardTeamName } from "@/lib/archive/names";
import { clubColors } from "@/lib/dashboard/club-colors";
import { matchDayRoundLabel } from "@/lib/dashboard/match-result-labels";
import { competitionCardName } from "@/lib/names/competition-names";
import { cardVenueName } from "@/lib/names/venue-names";
import { cardPersonName } from "@/lib/names/person-name";
import { shortTeamName } from "@/lib/names/team-short-names";
import { loadReelContext } from "@/lib/reels/context-data";
import { reelQualityOk } from "@/lib/reels/scenes";
import { refreshReelSquads, type ReelSquadDeps, type ReelSquadEntry, type ReelSquadPlayer } from "@/lib/reels/squad-rule";
import { getFixtureById } from "@/lib/services/api-football/fixtures";
import { getHeadToHead } from "@/lib/services/api-football/match-stats";
import { getTeamSquad } from "@/lib/services/api-football/squads";
import { getTeamLeaguePlayers } from "@/lib/services/api-football/team-player-stats";
import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import { getReelsMatch } from "@/lib/services/reels-client";
import type { ReelsMatchDetail } from "@/lib/services/reels-schema";
import type { PlayerSeason } from "../../src/story/match-data";
import type { FrozenExtras, SideInfo } from "../../src/story/from-contract";

/**
 * Dondurma: servis yanıtı + API-Football okuması tek JSON'a yazılır. Veritabanına dokunmaz; kadro önbelleği dosyadadır.
 * Kaynak hatası dondurmayı durdurmaz, ilgili sahne kapanır, uyarı `warnings`e yazılır.
 */

export const REAL_ROOT = path.resolve(process.cwd(), "../../test-photos/reels-real");
const SQUAD_CACHE = path.join(REAL_ROOT, "_kadro");
const LOGO_DIR = path.resolve(process.cwd(), "public/_local/logos");
const MAX_CANDIDATES = 8;
const NEUTRAL = { primary: "#FFFFFF", secondary: "#C0C0C0" };

export interface Frozen {
  fetched_at: string;
  squad_checked_at: string | null;
  quality_ok: boolean;
  detail: ReelsMatchDetail;
  extras: FrozenExtras;
  warnings: string[];
  requests: Record<string, number>;
}

const squadFile = (teamId: number) => path.join(SQUAD_CACHE, `${teamId}.json`);

const SQUAD_DEPS: ReelSquadDeps = {
  fetchSquad: async (teamId) => {
    const squad = await getTeamSquad(teamId);
    if (!squad.ok) return { ok: false, message: squad.error.message };
    return { ok: true, data: squad.data.flatMap((entry) => (entry.name ? [{ id: entry.id, name: entry.name, number: entry.number }] : [])) };
  },
  readStored: async (teamId) => {
    if (!existsSync(squadFile(teamId))) return null;
    const stored = JSON.parse(readFileSync(squadFile(teamId), "utf8")) as { players: ReelSquadPlayer[]; checkedAt: string };
    return { players: stored.players, checkedAt: new Date(stored.checkedAt) };
  },
  store: async (teamId, entry: ReelSquadEntry) => {
    mkdirSync(SQUAD_CACHE, { recursive: true });
    writeFileSync(squadFile(teamId), JSON.stringify({ players: entry.players, checkedAt: entry.checkedAt.toISOString() }));
  },
};

async function localLogo(team: { id: number; logo_url: string | null }, warnings: string[]): Promise<{ logo: string; colors: { primary: string; secondary: string } | null }> {
  mkdirSync(LOGO_DIR, { recursive: true });
  const file = path.join(LOGO_DIR, `${team.id}.png`);
  const relative = `_local/logos/${team.id}.png`;
  if (!existsSync(file)) {
    if (!team.logo_url) {
      warnings.push(`Takım ${team.id}: logo adresi yok`);
      return { logo: "placeholders/silhouette.svg", colors: null };
    }
    const response = await fetch(team.logo_url);
    if (!response.ok) {
      warnings.push(`Takım ${team.id}: logo indirilemedi (HTTP ${response.status})`);
      return { logo: "placeholders/silhouette.svg", colors: null };
    }
    await sharp(Buffer.from(await response.arrayBuffer())).resize(512, 512, { fit: "inside", withoutEnlargement: false }).png().toFile(file);
  }
  return { logo: relative, colors: null };
}

async function sideInfo(team: ReelsMatchDetail["teams"]["home"], warnings: string[]): Promise<SideInfo> {
  const name = cardTeamName(team.name);
  const { logo } = await localLogo(team, warnings);
  const table = clubColors(team.id);
  if (!table) warnings.push(`${name}: kulüp renk tablosunda yok, nötr renk`);
  return { id: team.id, name, short_name: shortTeamName(name), logo, colors: table ? { primary: table.primary, secondary: table.secondary } : NEUTRAL };
}

function playerSeason(player: ApiFootballPlayerSeason, teamId: number, leagueId: number): PlayerSeason | null {
  const line = player.statistics.find((entry) => entry.team.id === teamId && entry.league.id === leagueId);
  if (!line?.games) return null;
  return {
    id: player.player.id,
    name: cardPersonName({ apiName: player.player.name }).name,
    team_id: teamId,
    appearances: line.games.appearences ?? 0,
    minutes: line.games.minutes ?? 0,
    goals: line.goals?.total ?? null,
    assists: line.goals?.assists ?? null,
    shots: line.shots?.total ?? null,
    shots_on_target: line.shots?.on ?? null,
    key_passes: line.passes?.key ?? null,
  };
}

const contribution = (player: PlayerSeason) => (player.goals ?? 0) + (player.assists ?? 0);

type Lineup = NonNullable<NonNullable<Awaited<ReturnType<typeof loadReelContext>>["context"]>["teams"]["home"]["lineup"]>;

/**
 * İlk 11 adları API-Football diziliş ucundan Türkçe harfsiz gelebiliyor ("U. Cakir"). Aynı kimliğin güncel kadro adı
 * ("U. Çakır") yazılır; kadroda olmayan oyuncunun adı değişmez (zaten "?" olur).
 */
export function restoreLineupNames(lineup: Lineup, squad: readonly { id: number; name: string }[]): Lineup {
  const byId = new Map(squad.map((player) => [player.id, player.name]));
  return {
    ...lineup,
    players: lineup.players.map((player) => {
      const name = byId.get(player.id);
      return name ? { ...player, short_name: name, name: name.replace(/^\p{L}\.\s*/u, "") } : player;
    }),
  };
}

export async function freezeMatch(matchId: number, now: Date = new Date()): Promise<Frozen> {
  const response = await getReelsMatch(matchId);
  if (!response.ok) throw new Error(response.error.message);
  const detail = response.data;
  const warnings: string[] = [];
  const kickoffUtc = new Date(detail.match.kickoff_utc);
  const leagueId = detail.match.league.id;
  const [homeTeam, awayTeam] = [detail.teams.home, detail.teams.away];

  const squads = await refreshReelSquads([{ id: homeTeam.id, name: homeTeam.name }, { id: awayTeam.id, name: awayTeam.name }], SQUAD_DEPS, now);
  warnings.push(...squads.warnings);
  const reading = await loadReelContext({ matchId, leagueId, homeTeamId: homeTeam.id, homeName: homeTeam.name, awayTeamId: awayTeam.id, awayName: awayTeam.name, kickoffUtc }, undefined, now);
  warnings.push(...reading.warnings);

  const fixture = await getFixtureById(matchId);
  if (!fixture.ok) warnings.push(`Fikstür: ${fixture.error.message}`);
  const h2h = await getHeadToHead(homeTeam.id, awayTeam.id, kickoffUtc.toISOString());
  if (!h2h.ok) warnings.push(`Karşılaşmalar: ${h2h.error.message}`);

  const season = reading.context?.season ?? null;
  const candidates = async (teamId: number) => {
    if (season === null) return [];
    const list = await getTeamLeaguePlayers(teamId, season, leagueId);
    if (!list.ok) {
      warnings.push(`Oyuncular ${teamId}: ${list.error.message}`);
      return [];
    }
    return list.data.flatMap((player) => playerSeason(player, teamId, leagueId) ?? []).sort((a, b) => contribution(b) - contribution(a)).slice(0, MAX_CANDIDATES);
  };
  const storedSquad = async (teamId: number) => ((await SQUAD_DEPS.readStored(teamId))?.players ?? []).map(({ id, name }) => ({ id, name }));
  const leagueName = competitionCardName(leagueId, detail.match.league.name);
  const cardName = (name: string) => cardTeamName(name);

  const squadOf = { home: await storedSquad(homeTeam.id), away: await storedSquad(awayTeam.id) };
  const context = reading.context && {
    ...reading.context,
    teams: {
      home: { ...reading.context.teams.home, lineup: reading.context.teams.home.lineup && restoreLineupNames(reading.context.teams.home.lineup, squadOf.home) },
      away: { ...reading.context.teams.away, lineup: reading.context.teams.away.lineup && restoreLineupNames(reading.context.teams.away.lineup, squadOf.away) },
    },
  };

  const extras: FrozenExtras = {
    league_name: leagueName,
    round: matchDayRoundLabel(fixture.ok ? fixture.data.details?.round ?? null : detail.match.league.round) || null,
    venue: fixture.ok && fixture.data.details?.venueName ? cardVenueName(fixture.data.details.venueName).name : null,
    referee: detail.match.referee,
    teams: { home: await sideInfo(homeTeam, warnings), away: await sideInfo(awayTeam, warnings) },
    players: {
      squad_checked_at: squads.checkedAt?.toISOString() ?? null,
      squads: squadOf,
      candidates: { home: await candidates(homeTeam.id), away: await candidates(awayTeam.id) },
      vs_opponent: [],
      duel_scope: `${leagueName} · bu sezon`,
    },
    context,
    h2h_matches: h2h.ok ? h2h.data.matches.map((match) => ({ date: match.kickoffUtc, home: cardName(match.homeTeamName), away: cardName(match.awayTeamName), home_score: match.homeGoals, away_score: match.awayGoals })) : [],
  };
  return { fetched_at: now.toISOString(), squad_checked_at: extras.players.squad_checked_at, quality_ok: reelQualityOk(detail) && !detail.quality.stale, detail, extras, warnings, requests: reading.requests };
}


