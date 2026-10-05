import { apiFootballRequest } from "@/lib/services/api-football/client";
import { getFixtureById, getFixtureDetailsByIds } from "@/lib/services/api-football/fixtures";
import {
  RECENT_FORM_SIZE,
  computeHeadToHead,
  computeRecentForm,
  selectFinishedBefore,
} from "@/lib/services/api-football/form-mappers";
import {
  apiFootballFixturesResponseSchema,
  type ApiFootballError,
  type ApiFootballFixtureDetailRaw,
} from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";
import type { HeadToHeadSummary, MatchStats, TeamRecentForm, TeamRef } from "@/types/sports";

/** Form: 30 dk tazelik (bkz. CLAUDE.md 2.3). */
const FORM_TTL_MS = 30 * 60 * 1000;
/** Head-to-head statiktir — maç başına bir kez çekilmesi yeterli (bkz. CLAUDE.md 2.3). */
const H2H_TTL_MS = 6 * 60 * 60 * 1000;
/** Kupa/erteleme vb. ile bitmemiş maçları eledikten sonra 5 bitmiş maç kalsın diye fazladan çekilir. */
const LAST_FIXTURES_LOOKUP = 10;
const HEAD_TO_HEAD_SIZE = 5;

async function getLastFixtures(teamId: number) {
  const result = await apiFootballRequest(
    "/fixtures",
    { team: String(teamId), last: String(LAST_FIXTURES_LOOKUP) },
    { ttlMs: FORM_TTL_MS },
  );
  if (!result.ok) return result;
  const parsed = apiFootballFixturesResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: { code: "INVALID_RESPONSE" as const, message: `Takım son maçları şemaya uymuyor: ${parsed.error.message}` },
    };
  }
  return { ok: true as const, data: parsed.data.response };
}

/**
 * Takımın maç öncesi son 5 bitmiş maçının istatistikli detayı (eskiden yeniye). İki istek:
 * son maç listesi + bu maçların detayı (`/fixtures?ids=` — xG, maç ve oyuncu istatistikleri).
 */
export async function getRecentFixtureDetails(
  team: TeamRef,
  beforeUtc: string,
): Promise<Result<ApiFootballFixtureDetailRaw[], ApiFootballError>> {
  const last = await getLastFixtures(Number(team.id));
  if (!last.ok) return last;

  const recent = selectFinishedBefore(last.data, beforeUtc, RECENT_FORM_SIZE);
  const details = await getFixtureDetailsByIds(recent.map((raw) => raw.fixture.id));
  if (!details.ok) return details;
  return { ok: true, data: selectFinishedBefore(details.data, beforeUtc, RECENT_FORM_SIZE) };
}

/** Takımın maç öncesi son 5 bitmiş maçından form, gol ve xG ortalamaları. */
export async function getTeamRecentForm(
  team: TeamRef,
  beforeUtc: string,
): Promise<Result<TeamRecentForm, ApiFootballError>> {
  const details = await getRecentFixtureDetails(team, beforeUtc);
  if (!details.ok) return details;
  return { ok: true, data: computeRecentForm(details.data, { id: Number(team.id), name: team.name, logoUrl: team.logoUrl }) };
}

export async function getHeadToHead(
  homeTeamId: number,
  awayTeamId: number,
  beforeUtc: string,
): Promise<Result<HeadToHeadSummary, ApiFootballError>> {
  const result = await apiFootballRequest(
    "/fixtures/headtohead",
    { h2h: `${homeTeamId}-${awayTeamId}`, last: String(HEAD_TO_HEAD_SIZE + 1) },
    { ttlMs: H2H_TTL_MS },
  );
  if (!result.ok) return result;

  const parsed = apiFootballFixturesResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_RESPONSE", message: `H2H yanıtı şemaya uymuyor: ${parsed.error.message}` } };
  }

  const finished = selectFinishedBefore(parsed.data.response, beforeUtc, HEAD_TO_HEAD_SIZE).reverse();
  return { ok: true, data: computeHeadToHead(finished, homeTeamId) };
}

/**
 * Tek bir maçın içerik üretiminde kullanılan tüm gerçek verisi: fikstür, iki takımın
 * formu/xG'si ve aralarındaki son maçlar. Yaklaşık 6 istek, hepsi önbellekli.
 */
export async function getMatchStats(apiFootballFixtureId: number): Promise<Result<MatchStats, ApiFootballError>> {
  const fixtureResult = await getFixtureById(apiFootballFixtureId);
  if (!fixtureResult.ok) return fixtureResult;
  const fixture = fixtureResult.data;

  const [home, away, headToHead] = await Promise.all([
    getTeamRecentForm(fixture.homeTeam, fixture.kickoffUtc),
    getTeamRecentForm(fixture.awayTeam, fixture.kickoffUtc),
    getHeadToHead(Number(fixture.homeTeam.id), Number(fixture.awayTeam.id), fixture.kickoffUtc),
  ]);
  if (!home.ok) return home;
  if (!away.ok) return away;
  if (!headToHead.ok) return headToHead;

  return {
    ok: true,
    data: {
      fixture,
      home: home.data,
      away: away.data,
      headToHead: headToHead.data,
      source: "api-football",
      fetchedAtUtc: new Date().toISOString(),
    },
  };
}
