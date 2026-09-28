import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { apiFootballRequest } from "@/lib/services/api-football/client";
import { isSupportedLeagueId } from "@/lib/services/api-football/leagues";
import { mapApiFootballFixtureToFixture } from "@/lib/services/api-football/mappers";
import {
  apiFootballFixtureDetailsResponseSchema,
  apiFootballFixturesResponseSchema,
  type ApiFootballError,
  type ApiFootballFixtureDetailRaw,
} from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";
import type { Fixture } from "@/types/sports";
import type { z } from "zod";

export interface FixtureDateRange {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
}

/** Tek sorguda istenebilecek en uzun aralık (ay ızgarası = 6 hafta) — her gün ayrı bir istektir. */
export const MAX_RANGE_DAYS = 42;
/** Aynı anda en fazla bu kadar gün sorgulanır — sağlayıcının dakika başı limitine nazik davranmak için. */
const DAY_REQUEST_CONCURRENCY = 7;
/** `/fixtures?ids=` tek istekte en fazla 20 kimlik kabul eder. */
const MAX_IDS_PER_REQUEST = 20;
/** Bitmiş maçların detayı değişmez — uzun süre önbellekte kalabilir. */
const FINISHED_DETAIL_TTL_MS = 6 * 60 * 60 * 1000;

function invalidResponse(provider: string, error: z.ZodError): ApiFootballError {
  return { code: "INVALID_RESPONSE", message: `${provider} yanıtı beklenen şemaya uymuyor: ${error.message}` };
}

async function getFixturesForDate(date: string): Promise<Result<Fixture[], ApiFootballError>> {
  const rawResult = await apiFootballRequest("/fixtures", { date, timezone: "Europe/Istanbul" });
  if (!rawResult.ok) return rawResult;

  const parsed = apiFootballFixturesResponseSchema.safeParse(rawResult.data);
  if (!parsed.success) return { ok: false, error: invalidResponse("API-Football /fixtures", parsed.error) };

  return {
    ok: true,
    data: parsed.data.response
      .filter((raw) => isSupportedLeagueId(raw.league.id))
      .map(mapApiFootballFixtureToFixture),
  };
}

/**
 * Desteklenen liglerin (bkz. leagues.ts) fikstürlerini tarih aralığı için çeker.
 *
 * API-Football'da `from`/`to` aralığı `league`+`season` olmadan kabul edilmez; sezon da lige
 * göre değişir. Bu yüzden aralık gün gün `date=` ile sorgulanır (en fazla MAX_RANGE_DAYS
 * istek, her biri önbellekli) ve desteklenen liglere göre filtrelenir.
 */
export async function getFixturesForDateRange(
  range: FixtureDateRange,
): Promise<Result<Fixture[], ApiFootballError>> {
  const start = parseISO(range.from);
  const days = differenceInCalendarDays(parseISO(range.to), start) + 1;
  if (!Number.isFinite(days) || days < 1 || days > MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: { code: "INVALID_RESPONSE", message: `Tarih aralığı 1-${MAX_RANGE_DAYS} gün olmalı.` },
    };
  }

  const dates = Array.from({ length: days }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  const fixtures: Fixture[] = [];
  for (let i = 0; i < dates.length; i += DAY_REQUEST_CONCURRENCY) {
    const results = await Promise.all(dates.slice(i, i + DAY_REQUEST_CONCURRENCY).map(getFixturesForDate));
    for (const result of results) {
      if (!result.ok) return result;
      fixtures.push(...result.data);
    }
  }

  fixtures.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return { ok: true, data: fixtures };
}

/** Bugünden başlayarak `days` günlük fikstür listesi. */
export function getUpcomingFixtures(days = 7): Promise<Result<Fixture[], ApiFootballError>> {
  const today = new Date();
  return getFixturesForDateRange({
    from: format(today, "yyyy-MM-dd"),
    to: format(addDays(today, days - 1), "yyyy-MM-dd"),
  });
}

/**
 * Ayrıntılı (istatistikli) fikstürleri kimlikle çeker, 20'lik gruplar halinde. Dönen dizi
 * yalnızca sağlayıcının bulduklarını içerir; sıra garanti değildir.
 */
export async function getFixtureDetailsByIds(
  apiFootballIds: number[],
  options: { ttlMs?: number } = {},
): Promise<Result<ApiFootballFixtureDetailRaw[], ApiFootballError>> {
  const unique = [...new Set(apiFootballIds)];
  const batches: number[][] = [];
  for (let i = 0; i < unique.length; i += MAX_IDS_PER_REQUEST) {
    batches.push(unique.slice(i, i + MAX_IDS_PER_REQUEST));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      apiFootballRequest("/fixtures", { ids: batch.join("-") }, { ttlMs: options.ttlMs ?? FINISHED_DETAIL_TTL_MS }),
    ),
  );

  const details: ApiFootballFixtureDetailRaw[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    const parsed = apiFootballFixtureDetailsResponseSchema.safeParse(result.data);
    if (!parsed.success) return { ok: false, error: invalidResponse("API-Football /fixtures?ids", parsed.error) };
    details.push(...parsed.data.response);
  }
  return { ok: true, data: details };
}

/** Kanonik fikstürleri kimlikle çeker — ör. kayıtlı taslakların maç etiketleri için. */
export async function getFixturesByIds(apiFootballIds: number[]): Promise<Result<Fixture[], ApiFootballError>> {
  if (apiFootballIds.length === 0) return { ok: true, data: [] };
  const result = await getFixtureDetailsByIds(apiFootballIds, { ttlMs: 60 * 60 * 1000 });
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapApiFootballFixtureToFixture) };
}

/** Tek bir fikstür — skor/durum güncel olsun diye kısa önbellekle. */
export async function getFixtureById(apiFootballId: number): Promise<Result<Fixture, ApiFootballError>> {
  const result = await getFixtureDetailsByIds([apiFootballId], { ttlMs: 60 * 1000 });
  if (!result.ok) return result;
  const raw = result.data[0];
  if (!raw) return { ok: false, error: { code: "NOT_FOUND", message: "Maç API-Football'da bulunamadı." } };
  return { ok: true, data: mapApiFootballFixtureToFixture(raw) };
}
