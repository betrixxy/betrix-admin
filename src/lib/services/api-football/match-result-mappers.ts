import { competitionKind, competitionName, resultRoundLabel, teamNameTr } from "@/lib/dashboard/match-result-labels";
import { teamColorHex } from "@/lib/dashboard/match-result-theme";
import { findTeamLineup, lineupColorHex } from "@/lib/services/api-football/lineup-mappers";
import type { ApiFootballEventRaw, ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { MatchOutcome, MatchResultFacts, MatchSide, MvpCandidate, ResultTeam, ScorerLine } from "@/types/match-result";

/** Maç Sonucu: ham bitmiş maç → kanonik `MatchResultFacts` (saf fonksiyonlar, yan etki yok). */

export const FINISHED_STATUSES = ["FT", "AET", "PEN"] as const;
type FinishedStatus = (typeof FINISHED_STATUSES)[number];

function isFinished(short: string): short is FinishedStatus {
  return FINISHED_STATUSES.some((status) => status === short);
}

/** 90 + 2 → "90+2'" */
export function formatMinute(elapsed: number | null, extra: number | null | undefined): string {
  if (elapsed === null) return "";
  return extra ? `${elapsed}+${extra}'` : `${elapsed}'`;
}

const eventKey = (event: ApiFootballEventRaw) => `${event.team.id}:${event.player.id ?? event.player.name ?? ""}:${event.time.elapsed ?? ""}`;

/**
 * Sayılan goller: kaçan penaltı, penaltı atışları ve VAR'ın iptal ettiği goller düşülür
 * (iptal, aynı takım/oyuncu/dakikadaki "Goal cancelled" olayıyla eşlenir).
 */
export function countedGoals(events: ApiFootballEventRaw[]): ApiFootballEventRaw[] {
  const cancelled = new Set(
    events.filter((event) => event.type === "Var" && /goal cancelled|goal disallowed/i.test(event.detail ?? "")).map(eventKey),
  );
  return events.filter(
    (event) =>
      event.type === "Goal" &&
      event.detail !== "Missed Penalty" &&
      !/penalty shootout/i.test(event.comments ?? "") &&
      !cancelled.has(eventKey(event)),
  );
}

/**
 * Bir tarafın golcü satırları, oluş sırasıyla. Kendi kalesine gol (KK) golü kazanan tarafa yazılır
 * (API olayı oyuncunun kendi takımıyla verir); aynı oyuncunun golleri tek satırda birleşir.
 */
export function scorerLines(goals: ApiFootballEventRaw[], teamId: number): ScorerLine[] {
  const lines = new Map<string, ScorerLine>();
  for (const goal of goals) {
    const ownGoal = goal.detail === "Own Goal";
    const creditedToTeam = ownGoal ? goal.team.id !== teamId : goal.team.id === teamId;
    if (!creditedToTeam) continue;
    const name = goal.player.name?.trim() || "Bilinmeyen oyuncu";
    const suffix = ownGoal ? " (KK)" : goal.detail === "Penalty" ? " (P)" : "";
    const key = `${goal.player.id ?? name}:${ownGoal ? "og" : "g"}`;
    const line = lines.get(key) ?? { playerId: goal.player.id ?? null, name, minutes: [] };
    line.minutes.push(`${formatMinute(goal.time.elapsed, goal.time.extra)}${suffix}`);
    lines.set(key, line);
  }
  return [...lines.values()];
}

function parseRating(value: string | null | undefined): number | null {
  const rating = Number(value);
  return value && Number.isFinite(rating) && rating > 0 ? rating : null;
}

/**
 * MVP önerisi: en yüksek rating — galibiyette kazanan takımdan, beraberlikte iki takımdan.
 * Hiç rating yoksa en çok gol atan (kendi kalesine goller sayılmaz). Veri yoksa null.
 */
function sideResolver(raw: ApiFootballFixtureResultRaw) {
  return (teamId: number): MatchSide | null => (teamId === raw.teams.home.id ? "HOME" : teamId === raw.teams.away.id ? "AWAY" : null);
}

function goalsByPlayer(goals: ApiFootballEventRaw[]): Map<number, number> {
  const goalsBy = new Map<number, number>();
  for (const goal of goals) {
    if (goal.detail === "Own Goal" || !goal.player.id) continue;
    goalsBy.set(goal.player.id, (goalsBy.get(goal.player.id) ?? 0) + 1);
  }
  return goalsBy;
}

/**
 * İki takımın maçta oynayan oyuncuları (rating'i ya da golü olanlar) — rating'e, sonra gole göre
 * azalan. Formdaki "MVP'yi değiştir" listesi ve MVP önerisi bu havuzdan gelir.
 */
export function playerPool(raw: ApiFootballFixtureResultRaw, goals: ApiFootballEventRaw[]): MvpCandidate[] {
  const sideOf = sideResolver(raw);
  const goalsBy = goalsByPlayer(goals);
  const pool = raw.players.flatMap(({ team, players }) => {
    const side = sideOf(team.id);
    if (!side) return [];
    return players.map(({ player, statistics }) => ({
      playerId: player.id,
      name: player.name,
      side,
      rating: parseRating(statistics[0]?.games?.rating),
      goals: goalsBy.get(player.id) ?? 0,
    }));
  });
  return pool
    .filter((candidate) => candidate.rating !== null || candidate.goals > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.goals - a.goals);
}

export function pickMvp(raw: ApiFootballFixtureResultRaw, outcome: MatchOutcome, goals: ApiFootballEventRaw[]): MvpCandidate | null {
  const sideOf = sideResolver(raw);
  const eligible = (side: MatchSide) => outcome === "DRAW" || outcome === side;
  const goalsBy = goalsByPlayer(goals);
  const candidates = playerPool(raw, goals).filter((candidate) => eligible(candidate.side));

  const rated = candidates.filter((candidate) => candidate.rating !== null);
  if (rated.length > 0) {
    return rated.reduce((best, candidate) => ((candidate.rating ?? 0) > (best.rating ?? 0) ? candidate : best));
  }

  // Oyuncu istatistiği hiç yoksa yalnızca olaylardan: en çok gol atan.
  const scorers = goals.filter((goal) => goal.detail !== "Own Goal" && goal.player.id);
  let best: MvpCandidate | null = null;
  for (const goal of scorers) {
    const side = sideOf(goal.team.id);
    const playerId = goal.player.id;
    if (!side || !eligible(side) || !playerId) continue;
    const count = goalsBy.get(playerId) ?? 0;
    if (!best || count > best.goals) best = { playerId, name: goal.player.name ?? "", side, rating: null, goals: count };
  }
  return best;
}

function outcomeOf(raw: ApiFootballFixtureResultRaw): MatchOutcome {
  if (raw.teams.home.winner === true) return "HOME";
  if (raw.teams.away.winner === true) return "AWAY";
  return "DRAW";
}

function resultTeam(raw: ApiFootballFixtureResultRaw, side: MatchSide, goals: ApiFootballEventRaw[]): ResultTeam {
  const team = side === "HOME" ? raw.teams.home : raw.teams.away;
  const lineup = findTeamLineup(raw.lineups, team.id);
  return {
    id: team.id,
    name: teamNameTr(team.name),
    logoUrl: team.logo,
    goals: (side === "HOME" ? raw.goals.home : raw.goals.away) ?? 0,
    scorers: scorerLines(goals, team.id),
    colorHex: (lineup ? lineupColorHex(lineup) : "") || teamColorHex(team.id),
  };
}

/** Bitmemiş maç (FT/AET/PEN dışı) için null — kart yalnızca kesinleşmiş skorla üretilir. */
export function toMatchResultFacts(raw: ApiFootballFixtureResultRaw): MatchResultFacts | null {
  const status = raw.fixture.status.short;
  if (!isFinished(status)) return null;

  const goals = countedGoals(raw.events);
  const outcome = outcomeOf(raw);
  const kind = competitionKind(raw.league.id);
  const penalty = raw.score?.penalty;

  return {
    fixtureId: raw.fixture.id,
    kickoffUtc: raw.fixture.date,
    statusShort: status,
    competition: { kind, name: competitionName(kind, raw.league.name), leagueId: raw.league.id, logoUrl: raw.league.logo ?? "" },
    roundLabel: resultRoundLabel(raw.league.round),
    home: resultTeam(raw, "HOME", goals),
    away: resultTeam(raw, "AWAY", goals),
    outcome,
    penaltyScore: penalty && penalty.home !== null && penalty.away !== null ? `${penalty.home}-${penalty.away}` : null,
    mvp: pickMvp(raw, outcome, goals),
    players: playerPool(raw, goals),
  };
}
