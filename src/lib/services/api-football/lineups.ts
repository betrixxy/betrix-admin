import { apiFootballRequest } from "@/lib/services/api-football/client";
import { getFixtureDetailsByIds } from "@/lib/services/api-football/fixtures";
import { findTeamLineup, isCompleteLineup, lineupColorHex, lineupStarters, mapSquad } from "@/lib/services/api-football/lineup-mappers";
import { getRecentFixtureDetails } from "@/lib/services/api-football/match-stats";
import { mapApiFootballFixtureToFixture } from "@/lib/services/api-football/mappers";
import {
  apiFootballSquadsResponseSchema,
  type ApiFootballError,
  type ApiFootballFixtureDetailRaw,
} from "@/lib/services/api-football/types";
import type { LineupReference, TeamLineupReference } from "@/types/lineup";
import type { Result } from "@/types/result";
import type { Fixture, TeamRef } from "@/types/sports";

/** Açıklanan kadro maçtan ~1 saat önce gelir — kısa tazelik. */
const FIXTURE_TTL_MS = 5 * 60 * 1000;
/** Kadro listesi gün içinde nadiren değişir. */
const SQUAD_TTL_MS = 6 * 60 * 60 * 1000;

async function getSquad(teamId: number) {
  const raw = await apiFootballRequest("/players/squads", { team: String(teamId) }, { ttlMs: SQUAD_TTL_MS });
  if (!raw.ok) return raw;
  const parsed = apiFootballSquadsResponseSchema.safeParse(raw.data);
  if (!parsed.success) {
    return { ok: false as const, error: { code: "INVALID_RESPONSE" as const, message: `Kadro yanıtı şemaya uymuyor: ${parsed.error.message}` } };
  }
  return { ok: true as const, data: mapSquad(parsed.data.response, teamId) };
}

function opponentName(raw: ApiFootballFixtureDetailRaw, teamId: number): string {
  return raw.teams.home.id === teamId ? raw.teams.away.name : raw.teams.home.name;
}

/**
 * Tek takımın referans 11'i: (1) bu maçın açıklanmış kadrosu, yoksa (2) takımın maç öncesi
 * son bitmiş maçındaki ilk 11 + diziliş (Maç Günü/Analiz ile aynı önbellekli istekler), yoksa boş.
 */
async function getTeamReference(
  team: TeamRef,
  fixture: Fixture,
  current: ApiFootballFixtureDetailRaw,
): Promise<Result<TeamLineupReference, ApiFootballError>> {
  const teamId = Number(team.id);
  const squad = await getSquad(teamId);
  if (!squad.ok) return squad;
  const base = { teamId, teamName: team.name, logoUrl: team.logoUrl, squad: squad.data };

  const announced = findTeamLineup(current.lineups, teamId);
  if (announced) {
    return {
      ok: true,
      data: {
        ...base,
        formation: announced.formation ?? null,
        starters: lineupStarters(announced),
        coach: announced.coach?.name ?? null,
        colorHex: lineupColorHex(announced),
        source: { kind: "announced" },
      },
    };
  }

  const recent = await getRecentFixtureDetails(team, fixture.kickoffUtc);
  if (!recent.ok) return recent;
  // Eskiden yeniye sıralı → en yeni maçtan geriye. Önce dizilişi + saha konumları tam olan en yeni
  // maç (genelde lig maçı); hiçbiri tam değilse ilk 11'i olan en yeni maç.
  const newestFirst = [...recent.data]
    .reverse()
    .flatMap((past) => {
      const lineup = findTeamLineup(past.lineups, teamId);
      return lineup ? [{ past, lineup }] : [];
    });
  const pick = newestFirst.find(({ lineup }) => isCompleteLineup(lineup)) ?? newestFirst[0];
  if (pick) {
    const { past, lineup } = pick;
    return {
      ok: true,
      data: {
        ...base,
        formation: lineup.formation ?? null,
        starters: lineupStarters(lineup),
        coach: lineup.coach?.name ?? null,
        colorHex: lineupColorHex(lineup),
        source: { kind: "last-match", date: past.fixture.date.slice(0, 10), opponent: opponentName(past, teamId) },
      },
    };
  }
  return { ok: true, data: { ...base, formation: null, starters: [], coach: null, colorHex: "", source: { kind: "none" } } };
}

/** Muhtemel 11 stüdyosunun verisi: iki takımın referans 11'i + seçim için güncel kadrolar. */
export async function getLineupReference(
  apiFootballFixtureId: number,
  fixtureId: string,
): Promise<Result<LineupReference & { fixture: Fixture }, ApiFootballError>> {
  const details = await getFixtureDetailsByIds([apiFootballFixtureId], { ttlMs: FIXTURE_TTL_MS });
  if (!details.ok) return details;
  const current = details.data[0];
  if (!current) return { ok: false, error: { code: "NOT_FOUND", message: "Maç API-Football'da bulunamadı." } };
  const fixture = mapApiFootballFixtureToFixture(current);

  const [home, away] = await Promise.all([
    getTeamReference(fixture.homeTeam, fixture, current),
    getTeamReference(fixture.awayTeam, fixture, current),
  ]);
  if (!home.ok) return home;
  if (!away.ok) return away;
  return { ok: true, data: { fixtureId, fixture, home: home.data, away: away.data } };
}
