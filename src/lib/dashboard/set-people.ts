import type { NameOrigin } from "@/lib/dashboard/name-case";
import { nameFor } from "@/lib/names/card-name-forms";
import { resolvePlayerNames, teamPeople, type TeamRefForNames } from "@/lib/names/person-directory";
import { namedScorerLines } from "@/lib/names/scorer-names";
import type { MatchResultFacts, MvpCandidate, ResultTeam } from "@/types/match-result";

/**
 * Set kartlarının (Maç Sonucu, İstatistikler) kişi adları — kart adı kuralından (arşiv düzeltmesi →
 * Sportmonks yaygın adı → API, bkz. `lib/names/person-name.ts`): golcü satırları (`scorer-names.ts`; kendi
 * kalesine golde iki takımın kadrosu) ve MVP adayları, KISA biçim. Takım kökeni önce
 * doldurulmuş olmalı (`withTeamOrigins`) — uyruk bulunamazsa ipucu odur.
 */

const teamRef = (team: ResultTeam): TeamRefForNames => ({ apiName: team.name, country: team.origin?.people === "tr" ? "Turkey" : null, peopleHint: team.origin?.people ?? null });

export async function withSetPeople<T extends { home: ResultTeam; away: ResultTeam }>(facts: T): Promise<T> {
  if (facts.home.scorers.length + facts.away.scorers.length === 0) return facts;
  // Düzeltmeler oyuncu kimliğiyle; KK golcüsü rakipte arandığı için iki takıma da bütün golcü kimlikleri.
  const ids = [...facts.home.scorers, ...facts.away.scorers].flatMap((line) => (line.playerId === null ? [] : [line.playerId]));
  const [home, away] = await Promise.all([teamPeople(teamRef(facts.home), ids), teamPeople(teamRef(facts.away), ids)]);
  return { ...facts, home: namedScorerLines(facts.home, home, away), away: namedScorerLines(facts.away, away, home) };
}

/** MVP adayları da (form listesi + kart satırı); `nameOrigin` kart satırının büyük harfi için. */
export async function withResultPeople(facts: MatchResultFacts): Promise<MatchResultFacts & { mvpOrigins: Map<number, NameOrigin | null> }> {
  const named = await withSetPeople(facts);
  const bySide = async (side: MvpCandidate["side"]) => {
    const players = facts.players.filter((player) => player.side === side);
    const names = await resolvePlayerNames(teamRef(side === "HOME" ? facts.home : facts.away), players.map((p) => ({ apiId: p.playerId, apiName: p.name })));
    return players.map((player, i) => ({ player: { ...player, name: names[i] ? nameFor("MATCH_RESULT_MVP", names[i]) : player.name }, origin: names[i]?.origin ?? null }));
  };
  const resolved = [...(await bySide("HOME")), ...(await bySide("AWAY"))];
  const byId = new Map(resolved.map((entry) => [entry.player.playerId, entry]));
  const players = facts.players.map((player) => byId.get(player.playerId)?.player ?? player);
  const mvp = facts.mvp ? (byId.get(facts.mvp.playerId)?.player ?? facts.mvp) : null;
  return { ...named, players, mvp, mvpOrigins: new Map(resolved.map((entry) => [entry.player.playerId, entry.origin])) };
}
