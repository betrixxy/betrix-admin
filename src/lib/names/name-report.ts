import { ARCHIVE_TEAM_NAMES, displayPersonName } from "@/lib/archive/names";
import { getSelectableFixtures } from "@/lib/dashboard/fixtures";
import { loadVenueOverrides } from "@/lib/names/venue-directory";
import { cardVenueName, venueNeedsReview } from "@/lib/names/venue-names";
import { matchPerson, personNeedsReview, restoreName } from "@/lib/names/person-name";
import { suspiciousAccent } from "@/lib/names/accent-check";
import { prisma } from "@/lib/prisma";
import { findSportmonksTeamId, getSportmonksSquad, searchSportmonksCoaches } from "@/lib/services/sportmonks/people";

/**
 * Ad raporu (Kütüphane → Ad Raporu): admin'in düzelteceği adlar, yalnızca okuma.
 *  - Kişiler: arşivdeki Türk kulüplerinin oyuncu/teknik direktörlerinden adı ASCII olup Türk uyruklu
 *    (Sportmonks) ya da Sportmonks'ta bulunamayan ve yabancı harfi olmayanlar — öneri Sportmonks adından.
 *  - Stadyumlar: önümüzdeki maçların stadyumlarından Türkçe karşılığı/düzeltmesi olmayanlar.
 *  - Aksan şüpheli: arşiv + son maç sonrası kartlarındaki adlardan sözcük sonu "è" taşıyanlar (öneri é).
 * Sportmonks istekleri 24 saat önbellekli (takım başına 2 istek); varsayılan kapsam Süper Lig.
 */

export const SUPER_LIG_ID = 203;

export interface PersonReportRow {
  personId: string;
  teamName: string;
  role: "PLAYER" | "COACH";
  current: string;
  /** Sportmonks adıyla harfleri geri yüklenmiş öneri; bulunamadıysa null. */
  suggestion: string | null;
  nationality: string | null;
}

export interface VenueReportRow {
  apiName: string;
  current: string;
  matches: string[];
}

async function teamRows(team: { name: string; apiName: string; people: { id: string; role: "PLAYER" | "COACH"; apiName: string; officialName: string; nameOverride: string | null }[] }): Promise<PersonReportRow[]> {
  const smTeamId = await findSportmonksTeamId(team.apiName, "Turkey");
  const squad = smTeamId === null ? [] : ((await getSportmonksSquad(smTeamId)) ?? []);
  const rows: PersonReportRow[] = [];
  for (const person of team.people) {
    const current = displayPersonName(person);
    const pool = person.role === "COACH" ? (await searchSportmonksCoaches(current.split(/\s+/u).at(-1) ?? "", smTeamId)).slice(0, 1) : squad;
    const match = matchPerson(current, pool) ?? matchPerson(person.apiName, pool);
    const suggestion = match ? restoreName(current, match) : null;
    if (personNeedsReview(current, match, suggestion)) rows.push({ personId: person.id, teamName: team.name, role: person.role, current, suggestion, nationality: match?.nationality ?? null });
  }
  return rows;
}

export async function personReport(leagueId = SUPER_LIG_ID): Promise<PersonReportRow[]> {
  const teams = await prisma.team.findMany({
    where: { country: "Turkey", national: false, currentLeagueId: leagueId },
    select: { officialName: true, apiName: true, people: { select: { id: true, role: true, apiName: true, officialName: true, nameOverride: true } } },
    orderBy: { officialName: "asc" },
  });
  const rows = await Promise.all(teams.map((team) => teamRows({ name: team.officialName, apiName: team.apiName, people: team.people })));
  return rows.flat();
}

export async function venueReport(): Promise<VenueReportRow[]> {
  const [fixtures, overrides] = await Promise.all([getSelectableFixtures(), loadVenueOverrides()]);
  if (!fixtures.ok) return [];
  const byVenue = new Map<string, string[]>();
  // Türk ligleri + Türk takımının oynadığı maçlar (yabancı lig stadyumları kartlara girmiyor).
  const turkish = fixtures.data.filter((f) => f.competition.id === "super-lig" || f.competition.id === "tff-1-lig" || [f.homeTeam.id, f.awayTeam.id].some((id) => ARCHIVE_TEAM_NAMES[Number(id)]));
  for (const fixture of turkish) {
    const venue = fixture.details?.venueName?.trim();
    if (venue) byVenue.set(venue, [...(byVenue.get(venue) ?? []), `${fixture.homeTeam.name} – ${fixture.awayTeam.name}`]);
  }
  return [...byVenue.entries()].flatMap(([apiName, matches]) => {
    const venue = cardVenueName(apiName, overrides);
    return venueNeedsReview(venue) ? [{ apiName, current: venue.name, matches }] : [];
  });
}

export interface AccentReportRow {
  name: string;
  suggestion: string;
  /** Adın görüldüğü yer(ler): arşiv takımı ya da son maç sonrası kartı. */
  sources: string[];
  /** Arşivde kayıtlıysa düzeltme formu için kişi kimliği. */
  personId: string | null;
}

/** Maç sonrası kartlarının bakılacağı geçmiş (gün). */
const ACCENT_LOOKBACK_DAYS = 30;

function factsPeople(snapshot: unknown): string[] {
  if (typeof snapshot !== "object" || snapshot === null) return [];
  const facts = snapshot as { players?: { name?: unknown }[]; home?: { scorers?: { name?: unknown }[] }; away?: { scorers?: { name?: unknown }[] } };
  const names = [...(facts.players ?? []), ...(facts.home?.scorers ?? []), ...(facts.away?.scorers ?? [])].map((person) => person.name);
  return names.filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

/**
 * "Aksan şüpheli" adlar (bkz. `accent-check.ts`) — yalnızca okuma, otomatik düzeltme yok. Kaynak: arşivdeki
 * bütün kişiler + son 30 günün Maç Sonucu kartlarındaki oyuncu/golcü adları (API'den gelip arşivde olmayan
 * yabancı oyuncular, ör. "Alphadjo Cissè").
 */
export async function accentReport(): Promise<AccentReportRow[]> {
  const since = new Date(Date.now() - ACCENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [people, results] = await Promise.all([
    prisma.person.findMany({ select: { id: true, officialName: true, nameOverride: true, currentTeam: { select: { officialName: true } } } }),
    prisma.aiContent.findMany({ where: { contentType: "MATCH_RESULT", createdAt: { gte: since } }, select: { statsSnapshot: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const rows = new Map<string, AccentReportRow>();
  const add = (name: string, source: string, personId: string | null) => {
    const suspicion = suspiciousAccent(name);
    if (!suspicion) return;
    const row = rows.get(name) ?? { name, suggestion: suspicion.suggestion, sources: [], personId };
    if (!row.sources.includes(source)) row.sources.push(source);
    row.personId ??= personId;
    rows.set(name, row);
  };
  for (const person of people) add(displayPersonName(person), `Arşiv · ${person.currentTeam?.officialName ?? "takımsız"}`, person.id);
  for (const result of results) {
    const facts = result.statsSnapshot as { home?: { name?: unknown }; away?: { name?: unknown } } | null;
    const match = [facts?.home?.name, facts?.away?.name].filter((name) => typeof name === "string").join(" – ");
    for (const name of factsPeople(result.statsSnapshot)) add(name, `Maç Sonucu · ${match || "maç"}`, null);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}
