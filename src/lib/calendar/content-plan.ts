import type { CalendarFixture, PlannedCalendarFixture } from "@/types/calendar";

export function hasContentPlan(fixture: CalendarFixture): fixture is PlannedCalendarFixture {
  return fixture.contentPlan !== undefined;
}
