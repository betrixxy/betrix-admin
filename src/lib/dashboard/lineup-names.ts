import { teamOrigin } from "@/lib/dashboard/team-origin";
import { resolveCoachName, resolvePlayerNames, type TeamRefForNames } from "@/lib/names/person-directory";
import type { Fixture } from "@/types/sports";
import type { LineupReference, TeamLineupReference } from "@/types/lineup";

/**
 * Muhtemel 11 referansının kişi adları — kart adı kuralından (arşiv düzeltmesi → Sportmonks → API, bkz.
 * `lib/names/person-name.ts`): kadro, referans 11 ve teknik direktör. Form bu adlarla açılır (admin yine
 * düzeltebilir); her oyuncu büyük harf kökenini (uyruk) taşır — "OSIMHEN", "U. ÇAKIR".
 */

async function namedTeam(ref: TeamLineupReference, apiName: string): Promise<TeamLineupReference> {
  const origin = await teamOrigin(ref.teamId);
  const team: TeamRefForNames = { apiName, country: origin.people === "tr" ? "Turkey" : null, peopleHint: origin.people };
  const [squad, starters, coach] = await Promise.all([
    resolvePlayerNames(team, ref.squad.map((p) => ({ apiId: p.id, apiName: p.name, jersey: p.number }))),
    resolvePlayerNames(team, ref.starters.map((s) => ({ apiId: s.id, apiName: s.name, jersey: s.number }))),
    ref.coach ? resolveCoachName(team, { apiId: null, apiName: ref.coach }) : null,
  ]);
  return {
    ...ref,
    squad: ref.squad.map((player, i) => ({ ...player, name: squad[i]?.name ?? player.name, origin: squad[i]?.origin ?? null })),
    starters: ref.starters.map((starter, i) => ({ ...starter, name: starters[i]?.name ?? starter.name, origin: starters[i]?.origin ?? null })),
    coach: coach?.name ?? ref.coach,
  };
}

export async function withCardNames<T extends LineupReference & { fixture: Fixture }>(reference: T): Promise<T> {
  const [home, away] = await Promise.all([namedTeam(reference.home, reference.fixture.homeTeam.name), namedTeam(reference.away, reference.fixture.awayTeam.name)]);
  return { ...reference, home, away };
}
