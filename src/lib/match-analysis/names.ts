import { nameFor } from "@/lib/names/card-name-forms";
import { cardNameInTeams, type TeamPeople } from "@/lib/names/person-name";
import type { AnalysisEvent, AnalysisPerson, MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Zaman çizelgesinin kişi adları (saf; sunucu yükleyicisi, görsel test ve offline araç aynı yoldan): kart adı
 * kuralı (`cardNameInTeams` — arşiv düzeltmesi → Sportmonks yaygın adı → API), KISA biçim
 * (`MATCH_ANALYSIS_EVENTS`: "V. OSIMHEN"). Kendi kalesine golde olay golün YAZILDIĞI tarafta, golü atan
 * rakipten: ad önce rakibin, sonra bu takımın kadrosunda aranır (set golcüleriyle aynı kural, `scorer-names.ts`).
 * Diğer bütün olaylar (kart, değişiklik, VAR) olayın takımının kadrosunda.
 */

export interface MatchPeople {
  home: TeamPeople;
  away: TeamPeople;
}

function named(person: AnalysisPerson | null, teams: readonly [TeamPeople, ...TeamPeople[]]): AnalysisPerson | null {
  if (!person) return null;
  const card = cardNameInTeams({ apiId: person.playerId, apiName: person.name }, teams);
  return { playerId: person.playerId, name: nameFor("MATCH_ANALYSIS_EVENTS", card), origin: card.origin };
}

export function namedEvent(event: AnalysisEvent, people: MatchPeople): AnalysisEvent {
  const [own, opponent] = event.side === "HOME" ? [people.home, people.away] : [people.away, people.home];
  const teams: readonly [TeamPeople, ...TeamPeople[]] = event.kind === "OWN_GOAL" ? [opponent, own] : [own];
  return { ...event, player: named(event.player, teams), related: named(event.related, [own]) };
}

export function withEventNames(facts: MatchAnalysisFacts, people: MatchPeople): MatchAnalysisFacts {
  return { ...facts, events: facts.events.map((event) => namedEvent(event, people)) };
}

/** Ad aranacak oyuncu kimlikleri (arşiv düzeltmeleri) — KK golcüsü rakipte arandığı için iki takıma da hepsi. */
export function eventPlayerIds(facts: MatchAnalysisFacts): number[] {
  const ids = facts.events.flatMap((event) => [event.player?.playerId, event.related?.playerId]);
  return [...new Set(ids.filter((id): id is number => typeof id === "number"))];
}
