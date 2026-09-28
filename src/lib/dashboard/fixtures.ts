import { format } from "date-fns";
import { getMockFixtures } from "@/lib/calendar/mock-fixtures";
import type { CalendarFixture } from "@/types/calendar";
import type { FixtureOption } from "@/types/social";

/**
 * Dashboard formlarında seçilebilir maçlar. Gerçek `Fixture` tablosu gelene kadar
 * mock fikstürlerden beslenir (bkz. CLAUDE.md 5.1 — önce mock ile geliştir).
 */
export function getSelectableFixtures(): CalendarFixture[] {
  return getMockFixtures();
}

export function toFixtureOption(fixture: CalendarFixture): FixtureOption {
  return {
    id: fixture.id,
    label: `${fixture.homeTeam.shortName} – ${fixture.awayTeam.shortName} · ${format(new Date(fixture.kickoffUtc), "d MMM")}`,
  };
}

export function getFixtureOptions(): FixtureOption[] {
  return getSelectableFixtures().map(toFixtureOption);
}

export function getFixtureLabels(): Record<string, string> {
  return Object.fromEntries(getFixtureOptions().map((option) => [option.id, option.label]));
}
