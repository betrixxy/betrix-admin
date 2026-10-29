import { originFromCountry, UNKNOWN_ORIGIN, type TeamOrigin } from "@/lib/dashboard/name-case";
import { prisma } from "@/lib/prisma";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import { getTeamInfo } from "@/lib/services/api-football/team-directory";

/**
 * Takımın kökeni (`upperName` ipucu, bkz. `name-case.ts::TeamOrigin`). Kaynak sırası: arşivdeki
 * `Team.country` (senkronlu Türk ligleri + eklenen takımlar), yoksa API-Football `/teams?id=`
 * (6 saat önbellekli, yalnızca okuma). İkisi de yoksa bilinmiyor — ad kendi harflerinden ya da
 * önceki davranışla (Türkçe) büyütülür. Milli takımın adı kartta Türkçe ("Almanya"): ad tr.
 */

const cache = new Map<number, TeamOrigin>();

async function lookup(teamId: number): Promise<TeamOrigin> {
  let country: string | null = null;
  let national = false;
  try {
    const archived = await prisma.team.findUnique({ where: { id: teamId }, select: { country: true, national: true } });
    country = archived?.country ?? null;
    national = archived?.national ?? false;
  } catch (cause) {
    console.error("[team-origin] arşiv okunamadı:", cause);
  }
  if (!country) {
    const info = await getTeamInfo(teamId);
    if (!info.ok || !info.data) return UNKNOWN_ORIGIN;
    country = info.data.country;
    national = info.data.national;
  }
  const people = originFromCountry(country);
  return { name: national ? "tr" : people, people };
}

export async function teamOrigin(teamId: number): Promise<TeamOrigin> {
  if (!Number.isFinite(teamId) || teamId <= 0) return UNKNOWN_ORIGIN;
  const cached = cache.get(teamId);
  if (cached) return cached;
  const origin = await lookup(teamId);
  // Bilinmeyen sonuç önbelleğe alınmaz (geçici API hatası kalıcı olmasın).
  if (origin.people) cache.set(teamId, origin);
  return origin;
}

/** Birden çok takım; kimlik → köken. */
export async function teamOrigins(teamIds: readonly number[]): Promise<Map<number, TeamOrigin>> {
  const unique = [...new Set(teamIds)];
  const origins = await Promise.all(unique.map((id) => teamOrigin(id)));
  return new Map(unique.map((id, index) => [id, origins[index] ?? UNKNOWN_ORIGIN]));
}

/** Maç verisinin iki takımına kökeni ekler (set kartları: Maç Sonucu, İstatistikler). */
export async function withTeamOrigins<T extends { home: { id: number; origin?: TeamOrigin }; away: { id: number; origin?: TeamOrigin } }>(facts: T): Promise<T> {
  const [home, away] = await Promise.all([teamOrigin(facts.home.id), teamOrigin(facts.away.id)]);
  return { ...facts, home: { ...facts.home, origin: home }, away: { ...facts.away, origin: away } };
}

/** Maç kimliğinden ("api-football-<id>") iki takımın kökeni; maç yoksa/okunamazsa undefined. */
export async function fixtureOrigins(fixtureId: string | null): Promise<{ home: TeamOrigin; away: TeamOrigin } | undefined> {
  const apiId = fixtureId ? parseFixtureId(fixtureId) : null;
  if (apiId === null) return undefined;
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return undefined;
  const [home, away] = await Promise.all([teamOrigin(Number(fixture.data.homeTeam.id)), teamOrigin(Number(fixture.data.awayTeam.id))]);
  return { home, away };
}
