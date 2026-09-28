import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getFixturesByIds, getUpcomingFixtures, parseFixtureId } from "@/lib/services/api-football";
import type { ApiFootballError } from "@/lib/services/api-football";
import type { Result } from "@/types/result";
import type { FixtureOption } from "@/types/social";
import type { Fixture } from "@/types/sports";

/** Dashboard formlarında ve Maç Merkezi'nde listelenen pencere (bugün dahil). */
export const SELECTABLE_FIXTURE_DAYS = 7;

/**
 * Dashboard formlarında seçilebilir gerçek maçlar — API-Football, desteklenen ligler
 * (bkz. lib/services/api-football/leagues.ts), önümüzdeki SELECTABLE_FIXTURE_DAYS gün.
 */
export function getSelectableFixtures(): Promise<Result<Fixture[], ApiFootballError>> {
  return getUpcomingFixtures(SELECTABLE_FIXTURE_DAYS);
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

/**
 * fixtureId → "Ev – Deplasman · tarih" etiketleri: yaklaşan maçlar + veritabanında gönderi/
 * görsel kaydı olan her maç (pencere dışındakiler kimlikle toplu çekilir). Çözülemeyen
 * kimlikler (ör. gerçek veriye geçiş öncesi mock kayıtlar) etiketsiz kalır; çağıranlar
 * `fixtureLabels[id] ?? id` ile ham kimliğe düşer.
 */
export async function getFixtureLabels(): Promise<Record<string, string>> {
  const [upcoming, postRows, contentRows] = await Promise.all([
    getSelectableFixtures(),
    prisma.socialPost.findMany({ distinct: ["fixtureId"], select: { fixtureId: true } }),
    prisma.aiContent.findMany({ distinct: ["fixtureId"], select: { fixtureId: true } }),
  ]);

  const labels: Record<string, string> = {};
  if (upcoming.ok) {
    for (const fixture of upcoming.data) labels[fixture.id] = formatFixtureLabel(fixture);
  }

  const missingIds = [...postRows, ...contentRows]
    .map((row) => row.fixtureId)
    .filter((id) => !(id in labels))
    .map(parseFixtureId)
    .filter((id): id is number => id !== null);

  const stored = await getFixturesByIds(missingIds);
  if (stored.ok) {
    for (const fixture of stored.data) labels[fixture.id] = formatFixtureLabel(fixture);
  }

  return labels;
}
