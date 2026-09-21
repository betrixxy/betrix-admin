import { endOfWeek, format, startOfWeek } from "date-fns";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { isSupportedLeagueId } from "@/lib/services/api-football/leagues";
import { mapApiFootballFixtureToFixture } from "@/lib/services/api-football/mappers";
import { apiFootballFixturesResponseSchema } from "@/lib/services/api-football/types";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";
import type { Fixture } from "@/types/sports";

export interface FixtureDateRange {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
}

/**
 * API-Football `/fixtures` uç noktasından fikstür listesi çeker (bkz. CLAUDE.md 1.5 —
 * Takvim modülünün besleneceği kaynak). `from === to` olduğunda dokümantasyondaki tekli
 * `date` parametresiyle (`/fixtures?date=YYYY-MM-DD`), aksi halde `from`/`to` aralığıyla
 * sorgular. Ham yanıt zod ile doğrulanır, ardından kanonik `Fixture[]`'a eşlenir.
 */
export async function getFixturesForDateRange(
  range: FixtureDateRange,
): Promise<Result<Fixture[], ApiFootballError>> {
  const params: Record<string, string> = range.from === range.to
    ? { date: range.from }
    : { from: range.from, to: range.to };

  const rawResult = await apiFootballRequest("/fixtures", params);
  if (!rawResult.ok) return rawResult;

  const parsed = apiFootballFixturesResponseSchema.safeParse(rawResult.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: `API-Football yanıtı beklenen şemaya uymuyor: ${parsed.error.message}`,
      },
    };
  }

  const fixtures = parsed.data.response
    .filter((raw) => isSupportedLeagueId(raw.league.id))
    .map(mapApiFootballFixtureToFixture);

  return { ok: true, data: fixtures };
}

function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Bugünün fikstürlerini çeker. */
export function getTodaysFixtures(): Promise<Result<Fixture[], ApiFootballError>> {
  const today = formatDate(new Date());
  return getFixturesForDateRange({ from: today, to: today });
}

/** İçinde bulunulan haftanın (Pazartesi–Pazar) fikstürlerini çeker. */
export function getFixturesForCurrentWeek(): Promise<Result<Fixture[], ApiFootballError>> {
  const now = new Date();
  return getFixturesForDateRange({
    from: formatDate(startOfWeek(now, { weekStartsOn: 1 })),
    to: formatDate(endOfWeek(now, { weekStartsOn: 1 })),
  });
}
