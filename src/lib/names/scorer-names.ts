import { nameFor } from "@/lib/names/card-name-forms";
import { cardNameInTeams, type TeamPeople } from "@/lib/names/person-name";
import { isOwnGoalLine } from "@/lib/services/api-football/match-result-mappers";
import type { ResultTeam } from "@/types/match-result";

/**
 * Set kartlarının golcü satırları (saf; sunucu `set-people.ts` ve görsel test aynı yoldan): kısa biçim
 * (`SET_SCORERS`). Kendi kalesine golün satırı golün YAZILDIĞI tarafta durur ama golü atan rakiptendir —
 * ad önce rakibin (golü atanın) kadrosunda, sonra bu takımın kadrosunda aranır; arşiv düzeltmesi oyuncu
 * kimliğiyle iki takımda da geçerli.
 */
export function namedScorerLines(team: ResultTeam, own: TeamPeople, opponent: TeamPeople): ResultTeam {
  if (team.scorers.length === 0) return team;
  return {
    ...team,
    scorers: team.scorers.map((line) => {
      const entry = { apiId: line.playerId, apiName: line.name };
      const card = cardNameInTeams(entry, isOwnGoalLine(line) ? [opponent, own] : [own]);
      return { ...line, name: nameFor("SET_SCORERS", card), origin: card.origin };
    }),
  };
}
