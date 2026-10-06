import { sportmonksRequest } from "@/lib/services/sportmonks/client";
import {
  computeSportmonksMetrics,
  isSameTeam,
  searchableTeamName,
  sportmonksFixtureListSchema,
  sportmonksTeamSearchSchema,
  type SportmonksFixture,
} from "@/lib/services/sportmonks/advanced-stats-mappers";
import type { SportmonksAdvancedMetrics } from "@/types/deep-analysis";
import type { Fixture } from "@/types/sports";

/** Sportmonks `between` aralığı 100 günle sınırlı; son 5 bitmiş maç için fazlasıyla yeterli. */
const HISTORY_DAYS = 90;
const RECENT_SIZE = 5;
const SEARCH_CANDIDATES = 3;
/** Takım arama sonucu değişmez. */
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Sportmonks `starting_at` UTC'dir: "2026-10-09 17:00:00". */
const startMs = (fixture: SportmonksFixture) => Date.parse(`${fixture.starting_at.replace(" ", "T")}Z`);

async function searchTeams(name: string) {
  const result = await sportmonksRequest(`/teams/search/${encodeURIComponent(searchableTeamName(name))}`, {}, { ttlMs: SEARCH_TTL_MS });
  if (!result.ok) return [];
  const parsed = sportmonksTeamSearchSchema.safeParse(result.data);
  return parsed.success ? parsed.data.data.slice(0, SEARCH_CANDIDATES) : [];
}

async function teamFixtures(teamId: number, fromMs: number, toMs: number, include: string): Promise<SportmonksFixture[] | null> {
  const result = await sportmonksRequest(`/fixtures/between/${ymd(fromMs)}/${ymd(toMs)}/${teamId}`, { include, per_page: "50" });
  if (!result.ok) return null;
  const parsed = sportmonksFixtureListSchema.safeParse(result.data);
  return parsed.success ? parsed.data.data : null;
}

/**
 * API-Football maçının iki takımının Sportmonks kimlikleri. İki sağlayıcı arasında kimlik tablosu
 * yok (bkz. CLAUDE.md 2.1): ev sahibi adıyla aranır, adayın başlama saatinin ±1 günündeki maçında
 * rakip adı da tutuyorsa eşleşme kabul edilir. Bulunamazsa `null` — tahmin edilmez.
 */
async function resolveTeamIds(fixture: Fixture): Promise<{ home: number; away: number } | null> {
  const kickoff = Date.parse(fixture.kickoffUtc);
  for (const candidate of await searchTeams(fixture.homeTeam.name)) {
    const fixtures = await teamFixtures(candidate.id, kickoff - DAY_MS, kickoff + DAY_MS, "participants");
    for (const match of fixtures ?? []) {
      if (Math.abs(startMs(match) - kickoff) > DAY_MS) continue;
      const home = match.participants.find((p) => p.id === candidate.id);
      const away = match.participants.find((p) => p.id !== candidate.id);
      if (home && away && isSameTeam(home.name, fixture.homeTeam.name) && isSameTeam(away.name, fixture.awayTeam.name)) {
        return { home: home.id, away: away.id };
      }
    }
  }
  return null;
}

async function recentMetrics(teamId: number, kickoff: number): Promise<SportmonksAdvancedMetrics | null> {
  const fixtures = await teamFixtures(teamId, kickoff - HISTORY_DAYS * DAY_MS, kickoff - 1, "statistics.type;participants");
  if (!fixtures) return null;
  const recent = fixtures
    .filter((f) => startMs(f) < kickoff && f.statistics.length > 0)
    .sort((a, b) => startMs(a) - startMs(b))
    .slice(-RECENT_SIZE);
  return recent.length > 0 ? computeSportmonksMetrics(recent, teamId) : null;
}

/**
 * Derin analize Sportmonks'tan ek metrikler (büyük şans, tehlikeli atak, orta/uzun pas isabeti).
 * Zenginleştirmedir: anahtar yoksa, maç eşleşmezse ya da istek düşerse iki taraf da `null` döner
 * ve analiz API-Football verisiyle devam eder. ~4-6 istek, hepsi önbellekli.
 */
export async function getSportmonksAdvancedMetrics(
  fixture: Fixture,
): Promise<{ home: SportmonksAdvancedMetrics | null; away: SportmonksAdvancedMetrics | null; matched: boolean }> {
  const ids = await resolveTeamIds(fixture);
  if (!ids) return { home: null, away: null, matched: false };
  const kickoff = Date.parse(fixture.kickoffUtc);
  const [home, away] = await Promise.all([recentMetrics(ids.home, kickoff), recentMetrics(ids.away, kickoff)]);
  return { home, away, matched: true };
}
