import { cardTeamName } from "@/lib/archive/names";
import { loadVenueOverrides } from "@/lib/names/venue-directory";
import { cardVenueName } from "@/lib/names/venue-names";
import { matchDayRoundLabel } from "@/lib/dashboard/match-result-labels";
import { getSelectableFixtures, formatFixtureLabel } from "@/lib/dashboard/fixtures";
import type { MatchDayFixtureOption } from "@/types/match-day";
import type { Result } from "@/types/result";
import type { Fixture } from "@/types/sports";

const ISTANBUL_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ISTANBUL_TIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});


function toOption(fixture: Fixture, venues: ReadonlyMap<string, string>): MatchDayFixtureOption {
  const kickoff = new Date(fixture.kickoffUtc);
  const details = fixture.details;
  return {
    id: fixture.id,
    label: `${formatFixtureLabel(fixture)} · ${fixture.competition.shortName}`,
    homeTeam: cardTeamName(fixture.homeTeam.name),
    awayTeam: cardTeamName(fixture.awayTeam.name),
    homeTeamId: Number(fixture.homeTeam.id),
    awayTeamId: Number(fixture.awayTeam.id),
    homeLogoUrl: fixture.homeTeam.logoUrl,
    awayLogoUrl: fixture.awayTeam.logoUrl,
    // Lig logosu kartlarda kullanılmaz (lig adı tipografik) — formdan da gönderilmez.
    leagueLogoUrl: "",
    league: fixture.competition.name,
    // Tur etiketi Türkçe ("3. Hafta", UEFA lig aşaması "3. Maç", "Çeyrek Final") — `matchDayRoundLabel`.
    week: matchDayRoundLabel(details?.round),
    date: ISTANBUL_DATE.format(kickoff),
    time: ISTANBUL_TIME.format(kickoff),
    // Stadyum kart adı: admin düzeltmesi → Türkçe karşılık → "Stadium → Stadyumu" (bkz. venue-names.ts).
    stadium: details?.venueName ? cardVenueName(details.venueName, venues).name : "",
    referee: details?.referee ?? "",
  };
}

/**
 * Önümüzdeki 7 günün gerçek maçları (API-Football) — formu otomatik doldurmak için tüm künye
 * bilgisiyle. Sağlayıcıya ulaşılamazsa hata döner; sayfa bunu gösterir ve alanlar elle doldurulabilir.
 */
export async function getMatchDayFixtureOptions(): Promise<Result<MatchDayFixtureOption[]>> {
  const result = await getSelectableFixtures();
  if (!result.ok) return { ok: false, error: { code: result.error.code, message: result.error.message } };
  const venues = await loadVenueOverrides();
  return { ok: true, data: result.data.map((fixture) => toOption(fixture, venues)) };
}
