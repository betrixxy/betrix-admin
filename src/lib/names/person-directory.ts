import type { NameOrigin } from "@/lib/dashboard/name-case";
import { cardCoachName, cardPlayerNames, type PersonEntry, type TeamPeople } from "@/lib/names/person-name";
import { prisma } from "@/lib/prisma";
import { findSportmonksTeamId, getSportmonksSquad, searchSportmonksCoaches } from "@/lib/services/sportmonks/people";
import type { CardPersonName, SportmonksPerson } from "@/types/person-name";

/**
 * Kart kişi adlarının sunucu tarafı: arşiv düzeltmeleri (Person.nameOverride) + Sportmonks kadrosu/koçu,
 * saf kural `person-name.ts::cardPersonName`. Kaynaklardan biri okunamazsa sıradakine düşülür — kart
 * hiçbir zaman ad yüzünden çizilmeden kalmaz (en kötü durumda API adı).
 */

export type { PersonEntry };

export interface TeamRefForNames {
  /** API-Football takım adı (ham, Sportmonks araması bununla). */
  apiName: string;
  /** API-Football ülke adı ("Turkey"); bilinmiyorsa null. */
  country: string | null;
  /** Uyruk bulunamazsa kişilerin varsayılan kökeni. */
  peopleHint: NameOrigin | null;
}

async function overrides(apiIds: readonly number[], role: "PLAYER" | "COACH"): Promise<Map<number, string>> {
  if (apiIds.length === 0) return new Map();
  try {
    const rows = await prisma.person.findMany({ where: { apiId: { in: [...apiIds] }, role, nameOverride: { not: null } }, select: { apiId: true, nameOverride: true } });
    return new Map(rows.flatMap((row) => (row.nameOverride?.trim() ? [[row.apiId, row.nameOverride.trim()] as const] : [])));
  } catch (cause) {
    console.error("[person-names] arşiv düzeltmeleri okunamadı:", cause);
    return new Map();
  }
}

async function squadFor(team: TeamRefForNames): Promise<{ teamId: number | null; people: SportmonksPerson[] }> {
  const teamId = await findSportmonksTeamId(team.apiName, team.country);
  return { teamId, people: teamId === null ? [] : ((await getSportmonksSquad(teamId)) ?? []) };
}

/** Takımın ad kaynakları: Sportmonks kadrosu + verilen oyuncuların arşiv düzeltmeleri (saf kurala girdi). */
export async function teamPeople(team: TeamRefForNames, apiIds: readonly number[]): Promise<TeamPeople> {
  const [fixes, squad] = await Promise.all([overrides(apiIds, "PLAYER"), squadFor(team)]);
  return { people: squad.people, overrides: fixes, teamHint: team.peopleHint };
}

/** Takımın oyuncu adları (girişle aynı sırada). */
export async function resolvePlayerNames(team: TeamRefForNames, entries: readonly PersonEntry[]): Promise<CardPersonName[]> {
  return cardPlayerNames(entries, await teamPeople(team, entries.flatMap((entry) => (entry.apiId === null ? [] : [entry.apiId]))));
}

/** Teknik direktör adı ("Ilhan Palut" → "İlhan Palut"); aynı kural. */
export async function resolveCoachName(team: TeamRefForNames, coach: PersonEntry): Promise<CardPersonName> {
  const surname = coach.apiName.trim().split(/\s+/u).at(-1) ?? "";
  const [fixes, teamId] = await Promise.all([overrides(coach.apiId === null ? [] : [coach.apiId], "COACH"), findSportmonksTeamId(team.apiName, team.country)]);
  const people = surname.length >= 3 ? await searchSportmonksCoaches(surname, teamId) : [];
  // Birden çok aday tutarsa takımı çalıştırmış olan (ilk sırada) seçilir.
  return cardCoachName(coach, { people, overrides: fixes, teamHint: team.peopleHint });
}
