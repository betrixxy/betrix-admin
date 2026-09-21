import type { CalendarFixture } from "@/types/calendar";

/** Maç kartından Stüdyo'ya taslak veri aktarımı — studio sayfası bu parametreleri henüz okumuyor. */
export function buildStudioHref(fixture: CalendarFixture): string {
  const params = new URLSearchParams({
    home: fixture.homeTeam.name,
    away: fixture.awayTeam.name,
    competition: fixture.competition.name,
    kickoff: fixture.kickoffUtc,
    fixtureId: fixture.id,
  });
  return `/studio?${params.toString()}`;
}
