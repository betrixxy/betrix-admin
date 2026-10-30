import type { NameOrigin } from "@/lib/dashboard/name-case";
import { teamPeople, type TeamRefForNames } from "@/lib/names/person-directory";
import { namedResultFacts } from "@/lib/names/result-people";
import { namedScorerLines } from "@/lib/names/scorer-names";
import type { MatchResultFacts, ResultTeam } from "@/types/match-result";

/**
 * Set kartlarının (Maç Sonucu, İstatistikler) kişi adları — kart adı kuralından (arşiv düzeltmesi →
 * Sportmonks yaygın adı → API, bkz. `lib/names/person-name.ts`): golcü satırları (`scorer-names.ts`; kendi
 * kalesine golde iki takımın kadrosu) ve MVP adayları, KISA biçim. Takım kökeni önce
 * doldurulmuş olmalı (`withTeamOrigins`) — uyruk bulunamazsa ipucu odur.
 */

export const teamRef = (team: ResultTeam): TeamRefForNames => ({ apiName: team.name, country: team.origin?.people === "tr" ? "Turkey" : null, peopleHint: team.origin?.people ?? null });

export async function withSetPeople<T extends { home: ResultTeam; away: ResultTeam }>(facts: T): Promise<T> {
  if (facts.home.scorers.length + facts.away.scorers.length === 0) return facts;
  // Düzeltmeler oyuncu kimliğiyle; KK golcüsü rakipte arandığı için iki takıma da bütün golcü kimlikleri.
  const ids = [...facts.home.scorers, ...facts.away.scorers].flatMap((line) => (line.playerId === null ? [] : [line.playerId]));
  const [home, away] = await Promise.all([teamPeople(teamRef(facts.home), ids), teamPeople(teamRef(facts.away), ids)]);
  return { ...facts, home: namedScorerLines(facts.home, home, away), away: namedScorerLines(facts.away, away, home) };
}

/** Golcüler + MVP adayları (form listesi + kart satırı); `mvpOrigins` kart satırının büyük harfi için. */
export async function withResultPeople(facts: MatchResultFacts): Promise<MatchResultFacts & { mvpOrigins: Map<number, NameOrigin | null> }> {
  const ids = [...facts.home.scorers, ...facts.away.scorers].flatMap((line) => (line.playerId === null ? [] : [line.playerId])).concat(facts.players.map((player) => player.playerId));
  const [home, away] = await Promise.all([teamPeople(teamRef(facts.home), ids), teamPeople(teamRef(facts.away), ids)]);
  const named = namedResultFacts(facts, home, away);
  return { ...named.facts, mvpOrigins: named.mvpOrigins };
}

/** Stüdyo özeti (golcüler, MVP önerisi, MVP listesi) — kartla AYNI ad kuralı; istemciye geçebilir (Map yok). */
export async function studioResultFacts(facts: MatchResultFacts): Promise<MatchResultFacts> {
  const { mvpOrigins, ...named } = await withResultPeople(facts);
  void mvpOrigins;
  return named;
}
