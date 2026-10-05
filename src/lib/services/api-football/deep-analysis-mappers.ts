import { computeRecentForm } from "@/lib/services/api-football/form-mappers";
import type { ApiFootballFixtureDetailRaw } from "@/lib/services/api-football/types";
import type { KeyPlayerStats, PlayerPosition, TeamDeepStats } from "@/types/deep-analysis";

/**
 * Derin analiz için saf hesaplamalar — ağ yok, side-effect yok (bkz. CLAUDE.md 1.4, 5.2).
 * Girdi: takımın maç öncesi son bitmiş maçlarının ayrıntılı fikstürleri (eskiden yeniye).
 * Bir istatistik hiçbir maçta yoksa ortalaması `null` olur — sıfır uydurulmaz.
 */

const KEY_PLAYER_LIMIT = 5;
/** Puan ortalaması tek maça dayanmasın diye anahtar oyuncu için tercih edilen asgari maç. */
const KEY_PLAYER_MIN_APPEARANCES = 2;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** "55%", "82%", 7, "1.99" gibi değerleri sayıya çevirir; okunamıyorsa null. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function teamStat(raw: ApiFootballFixtureDetailRaw, teamId: number, type: string): number | null {
  const row = raw.statistics.find((entry) => entry.team.id === teamId);
  return toNumber(row?.statistics.find((stat) => stat.type === type)?.value);
}

function isPosition(value: string | null | undefined): value is PlayerPosition {
  return value === "G" || value === "D" || value === "M" || value === "F";
}

interface PlayerAccumulator extends Omit<KeyPlayerStats, "avgRating"> {
  ratings: number[];
}

function teamPlayers(raw: ApiFootballFixtureDetailRaw, teamId: number) {
  return raw.players.find((entry) => entry.team.id === teamId)?.players ?? [];
}

/** Maç başı top kazanma (müdahale + top kesme) ve ikili mücadele toplamları — oyunculardan. */
function defensiveTotals(raw: ApiFootballFixtureDetailRaw, teamId: number) {
  const players = teamPlayers(raw, teamId);
  if (players.length === 0) return null;
  let ballWins = 0;
  let duelsTotal = 0;
  let duelsWon = 0;
  for (const { statistics } of players) {
    const stats = statistics[0];
    ballWins += (stats?.tackles?.total ?? 0) + (stats?.tackles?.interceptions ?? 0);
    duelsTotal += stats?.duels?.total ?? 0;
    duelsWon += stats?.duels?.won ?? 0;
  }
  return { ballWins, duelsTotal, duelsWon };
}

function accumulatePlayers(fixtures: ApiFootballFixtureDetailRaw[], teamId: number): KeyPlayerStats[] {
  const byId = new Map<number, PlayerAccumulator>();
  for (const raw of fixtures) {
    for (const { player, statistics } of teamPlayers(raw, teamId)) {
      const stats = statistics[0];
      const minutes = stats?.games?.minutes ?? 0;
      if (minutes <= 0) continue;

      const entry = byId.get(player.id) ?? {
        id: player.id,
        name: player.name,
        photoUrl: player.photo ?? "",
        position: null,
        appearances: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        keyPasses: 0,
        ratings: [],
      };
      entry.appearances += 1;
      entry.minutes += minutes;
      entry.goals += stats?.goals?.total ?? 0;
      entry.assists += stats?.goals?.assists ?? 0;
      entry.keyPasses += stats?.passes?.key ?? 0;
      const position = stats?.games?.position;
      if (isPosition(position)) entry.position = position;
      const rating = toNumber(stats?.games?.rating);
      if (rating !== null) entry.ratings.push(rating);
      byId.set(player.id, entry);
    }
  }

  const players = [...byId.values()].map(({ ratings, ...rest }) => ({ ...rest, avgRating: average(ratings) }));
  const regular = players.filter((player) => player.appearances >= KEY_PLAYER_MIN_APPEARANCES);
  return (regular.length >= 3 ? regular : players)
    .filter((player) => player.avgRating !== null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.goals + b.assists - (a.goals + a.assists))
    .slice(0, KEY_PLAYER_LIMIT);
}

function mostCommonFormation(fixtures: ApiFootballFixtureDetailRaw[], teamId: number): string | null {
  const counts = new Map<string, number>();
  for (const raw of fixtures) {
    const formation = raw.lineups.find((lineup) => lineup.team.id === teamId)?.formation;
    if (formation) counts.set(formation, (counts.get(formation) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [formation, count] of counts) {
    if (count > bestCount) [best, bestCount] = [formation, count];
  }
  return best;
}

export function computeTeamDeepStats(
  fixtures: ApiFootballFixtureDetailRaw[],
  team: { id: number; name: string; logoUrl: string },
): TeamDeepStats {
  const possession: number[] = [];
  const passAccuracy: number[] = [];
  const shotsOnTarget: number[] = [];
  const ballWins: number[] = [];
  let duelsTotal = 0;
  let duelsWon = 0;
  let statMatchesSampled = 0;
  let bttsCount = 0;
  let over25Count = 0;
  let cleanSheets = 0;
  let failedToScore = 0;

  for (const raw of fixtures) {
    const ownPossession = teamStat(raw, team.id, "Ball Possession");
    if (ownPossession !== null) {
      statMatchesSampled += 1;
      possession.push(ownPossession);
    }
    const accuracy = teamStat(raw, team.id, "Passes %");
    if (accuracy !== null) passAccuracy.push(accuracy);
    const onTarget = teamStat(raw, team.id, "Shots on Goal");
    if (onTarget !== null) shotsOnTarget.push(onTarget);

    const defensive = defensiveTotals(raw, team.id);
    if (defensive) {
      ballWins.push(defensive.ballWins);
      duelsTotal += defensive.duelsTotal;
      duelsWon += defensive.duelsWon;
    }

    const { home, away } = raw.goals;
    if (home === null || away === null) continue;
    const isHome = raw.teams.home.id === team.id;
    const [scored, conceded] = isHome ? [home, away] : [away, home];
    if (scored > 0 && conceded > 0) bttsCount += 1;
    if (scored + conceded > 2.5) over25Count += 1;
    if (conceded === 0) cleanSheets += 1;
    if (scored === 0) failedToScore += 1;
  }

  return {
    form: computeRecentForm(fixtures, team),
    statMatchesSampled,
    possessionAvg: average(possession),
    passAccuracyAvg: average(passAccuracy),
    shotsOnTargetAvg: average(shotsOnTarget),
    ballWinsAvg: average(ballWins),
    duelsWonPct: duelsTotal > 0 ? (duelsWon / duelsTotal) * 100 : null,
    bttsCount,
    over25Count,
    cleanSheets,
    failedToScore,
    formation: mostCommonFormation(fixtures, team.id),
    keyPlayers: accumulatePlayers(fixtures, team.id),
  };
}
