import { format } from "date-fns";
import { MATCH_CENTER_PAST_DAYS, SELECTABLE_FIXTURE_DAYS } from "@/lib/dashboard/match-center-window";
import { prisma } from "@/lib/prisma";
import { getFixturesByIds, getUpcomingFixtures, parseFixtureId } from "@/lib/services/api-football";
import type { ApiFootballError } from "@/lib/services/api-football";
import type { Result } from "@/types/result";
import type { FixtureOption } from "@/types/social";
import type { Fixture } from "@/types/sports";

export { MATCH_CENTER_PAST_DAYS, SELECTABLE_FIXTURE_DAYS };

/**
 * Maç öncesi formlarda seçilebilir gerçek maçlar — API-Football, desteklenen ligler
 * (bkz. lib/services/api-football/leagues.ts), bugünden itibaren SELECTABLE_FIXTURE_DAYS gün.
 */
export function getSelectableFixtures(): Promise<Result<Fixture[], ApiFootballError>> {
  return getUpcomingFixtures(SELECTABLE_FIXTURE_DAYS);
}

/** Maç Merkezi: MATCH_CENTER_PAST_DAYS gün geriden (biten maçlar) + önümüzdeki SELECTABLE_FIXTURE_DAYS gün. */
export function getMatchCenterFixtures(): Promise<Result<Fixture[], ApiFootballError>> {
  return getUpcomingFixtures(SELECTABLE_FIXTURE_DAYS, MATCH_CENTER_PAST_DAYS);
}

export function formatFixtureLabel(fixture: Fixture): string {
  return `${fixture.homeTeam.shortName} – ${fixture.awayTeam.shortName} · ${format(new Date(fixture.kickoffUtc), "d MMM")}`;
}

export function toFixtureOption(fixture: Fixture): FixtureOption {
  return { id: fixture.id, label: formatFixtureLabel(fixture) };
}

/** Sağlayıcıya ulaşılamazsa boş liste döner — formlar "maç yok" durumunu kendileri gösterir. */
export async function getFixtureOptions(): Promise<FixtureOption[]> {
  const result = await getSelectableFixtures();
  return result.ok ? result.data.map(toFixtureOption) : [];
}

/** fixtureId → maçtaki iki takım (API-Football kimliği + ad) — Fotoğraf Arşivi seçicisi için. */
export async function getFixtureTeams(): Promise<Record<string, { id: number; name: string }[]>> {
  const result = await getSelectableFixtures();
  if (!result.ok) return {};
  return Object.fromEntries(
    result.data.map((fixture) => [fixture.id, [fixture.homeTeam, fixture.awayTeam].map((team) => ({ id: Number(team.id), name: team.name }))]),
  );
}

/**
 * fixtureId → "Ev – Deplasman · tarih" etiketleri: yaklaşan maçlar + veritabanında gönderi/
 * görsel kaydı olan her maç (pencere dışındakiler kimlikle toplu çekilir). Çözülemeyen
 * kimlikler (ör. gerçek veriye geçiş öncesi mock kayıtlar) etiketsiz kalır; çağıranlar
 * `fixtureLabels[id] ?? id` ile ham kimliğe düşer.
 */
export async function getFixtureLabels(): Promise<Record<string, string>> {
  const [upcoming, postRows, contentRows] = await Promise.all([
    getMatchCenterFixtures(),
    prisma.socialPost.findMany({ distinct: ["fixtureId"], select: { fixtureId: true } }),
    prisma.aiContent.findMany({ distinct: ["fixtureId"], select: { fixtureId: true } }),
  ]);

  const labels: Record<string, string> = {};
  if (upcoming.ok) {
    for (const fixture of upcoming.data) labels[fixture.id] = formatFixtureLabel(fixture);
  }

  const missingIds = [...postRows, ...contentRows]
    .map((row) => row.fixtureId)
    .filter((id): id is string => id !== null && !(id in labels))
    .map(parseFixtureId)
    .filter((id): id is number => id !== null);

  const stored = await getFixturesByIds(missingIds);
  if (stored.ok) {
    for (const fixture of stored.data) labels[fixture.id] = formatFixtureLabel(fixture);
  }

  return labels;
}
