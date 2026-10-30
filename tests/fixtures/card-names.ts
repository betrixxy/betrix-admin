import type { NameOrigin } from "@/lib/dashboard/name-case";
import { cardCoachName, cardPlayerNames, type PersonEntry, type TeamPeople } from "@/lib/names/person-name";
import { coachPeople, squadPeople } from "@/lib/services/sportmonks/people-mappers";
import type { CardPersonName } from "@/types/person-name";

/**
 * Görsel testlerin kişi adları ÜRETİM YOLUNDAN: sabit Sportmonks yanıtı (`sportmonks/people.ts`) → aynı
 * ayrıştırıcı (`people-mappers.ts`) → aynı kural (`cardPlayerNames` / `cardCoachName`); kart biçimi tüketicide
 * `nameFor(<yuva>, …)` ile seçilir. Elle yazılmış kart adı yok — ad kuralı bozulursa görsel test de kırılır.
 * Arşiv düzeltmesi (`nameOverride`) DB'de olduğu için burada boş; o yol birim testte.
 */

export interface FixtureTeam {
  /** Sabit `/squads/teams/{id}` (oyuncular) ya da `/coaches/search/{ad}` (koç) yanıtı. */
  sportmonks: unknown;
  /** Takımın kişi kökeni ipucu (`withTeamOrigins` üretimde doldurur). */
  hint: NameOrigin | null;
}

const NO_OVERRIDES: ReadonlyMap<number, string> = new Map();

/** Takımın ad kaynakları (`person-directory.ts::teamPeople` gibi) — sabit yanıttan. */
export function fixtureTeamPeople(team: FixtureTeam): TeamPeople {
  const people = squadPeople(team.sportmonks);
  if (!people) throw new Error("Sabit Sportmonks kadro yanıtı şemaya uymuyor");
  return { people, overrides: NO_OVERRIDES, teamHint: team.hint };
}

export function fixturePlayerNames(team: FixtureTeam, entries: readonly PersonEntry[]): CardPersonName[] {
  return cardPlayerNames(entries, fixtureTeamPeople(team));
}

export function fixtureCoachName(team: FixtureTeam, apiName: string): CardPersonName {
  return cardCoachName({ apiId: null, apiName }, { people: coachPeople(team.sportmonks, null), overrides: NO_OVERRIDES, teamHint: team.hint });
}
