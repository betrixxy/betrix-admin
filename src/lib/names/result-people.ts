import type { NameOrigin } from "@/lib/dashboard/name-case";
import { nameFor } from "@/lib/names/card-name-forms";
import { cardPlayerNames, type TeamPeople } from "@/lib/names/person-name";
import { namedScorerLines } from "@/lib/names/scorer-names";
import type { MatchResultFacts } from "@/types/match-result";

/**
 * Maç Sonucu kişi adları (saf; sunucu `set-people.ts::withResultPeople`, stüdyo özeti ve birim test aynı yoldan):
 * golcü satırları (`namedScorerLines`, KISA biçim; kendi kalesine golde önce rakibin kadrosu) + MVP adayları
 * (`MATCH_RESULT_MVP`). Stüdyo özeti de bu adları yazar — kartta "Y. Akgün" yazarken stüdyoda ham API adı
 * ("Y. Akgun") görünmez (kurucu kararı 2026-10-30).
 */
export function namedResultFacts(facts: MatchResultFacts, home: TeamPeople, away: TeamPeople): { facts: MatchResultFacts; mvpOrigins: Map<number, NameOrigin | null> } {
  const named = { ...facts, home: namedScorerLines(facts.home, home, away), away: namedScorerLines(facts.away, away, home) };
  const origins = new Map<number, NameOrigin | null>();
  const renamed = new Map<number, string>();
  for (const side of ["HOME", "AWAY"] as const) {
    const players = facts.players.filter((player) => player.side === side);
    const names = cardPlayerNames(players.map((player) => ({ apiId: player.playerId, apiName: player.name })), side === "HOME" ? home : away);
    players.forEach((player, index) => {
      const name = names[index];
      if (!name) return;
      renamed.set(player.playerId, nameFor("MATCH_RESULT_MVP", name));
      origins.set(player.playerId, name.origin ?? null);
    });
  }
  const rename = <T extends { playerId: number; name: string }>(player: T): T => ({ ...player, name: renamed.get(player.playerId) ?? player.name });
  return { facts: { ...named, players: facts.players.map(rename), mvp: facts.mvp ? rename(facts.mvp) : null }, mvpOrigins: origins };
}
