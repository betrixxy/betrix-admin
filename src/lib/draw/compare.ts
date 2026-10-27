import type { DrawDifference, DrawState, KnockoutTie, LeagueFixture } from "@/types/draw";
import { drawTeamName } from "./entry";

/**
 * Kura sonrası: girilen eşleşmeler ile API fikstürü karşılaştırılır — yalnızca uyarı, otomatik düzeltme
 * YOK. Lig aşamasında yalnızca rakip girilmiş takımlar karşılaştırılır (API bütün takımları verir).
 */

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function compareTies(state: DrawState, api: KnockoutTie[]): DrawDifference[] {
  const name = (id: number) => drawTeamName(state, id);
  const differences: DrawDifference[] = [];
  const apiByPair = new Map(api.map((tie) => [pairKey(tie.first, tie.second), tie]));
  const enteredPairs = new Set(state.ties.map((tie) => pairKey(tie.first, tie.second)));
  for (const tie of state.ties) {
    const match = apiByPair.get(pairKey(tie.first, tie.second));
    if (!match) differences.push({ kind: "MISSING_IN_API", text: `Girilen eşleşme API'de yok: ${name(tie.first)} – ${name(tie.second)}` });
    else if (match.first !== tie.first) differences.push({ kind: "VENUE_SWAPPED", text: `${name(tie.first)} – ${name(tie.second)}: API'de ilk maç ${name(match.first)} sahasında` });
  }
  for (const tie of api) {
    if (!enteredPairs.has(pairKey(tie.first, tie.second))) differences.push({ kind: "MISSING_IN_ENTRY", text: `API'de var, girilmemiş: ${name(tie.first)} – ${name(tie.second)}` });
  }
  return differences;
}

export function compareLeague(state: DrawState, api: LeagueFixture[]): DrawDifference[] {
  const name = (id: number) => drawTeamName(state, id);
  const differences: DrawDifference[] = [];
  const teams = new Set(state.fixtures.map((f) => f.teamId));
  const key = (f: LeagueFixture) => `${f.teamId}:${f.opponentId}`;
  const apiByKey = new Map(api.filter((f) => teams.has(f.teamId)).map((f) => [key(f), f]));
  const entered = new Set(state.fixtures.map(key));
  for (const fixture of state.fixtures) {
    const match = apiByKey.get(key(fixture));
    if (!match) differences.push({ kind: "MISSING_IN_API", text: `Girilen rakip API'de yok: ${name(fixture.teamId)} – ${name(fixture.opponentId)}` });
    else if (match.venue !== fixture.venue) differences.push({ kind: "VENUE_SWAPPED", text: `${name(fixture.teamId)} – ${name(fixture.opponentId)}: API'de ${match.venue === "HOME" ? "iç saha" : "deplasman"}` });
  }
  for (const fixture of apiByKey.values()) {
    if (!entered.has(key(fixture))) differences.push({ kind: "MISSING_IN_ENTRY", text: `API'de var, girilmemiş: ${name(fixture.teamId)} – ${name(fixture.opponentId)} (${fixture.venue === "HOME" ? "iç saha" : "deplasman"})` });
  }
  return differences;
}

export function compareWithApi(state: DrawState, api: { ties: KnockoutTie[]; fixtures: LeagueFixture[] }): DrawDifference[] {
  return state.stage === "KNOCKOUT" ? compareTies(state, api.ties) : compareLeague(state, api.fixtures);
}
