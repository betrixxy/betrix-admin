import { env } from "@/lib/env";
import { fetchJson } from "@/lib/services/shared/http";
import {
  parseReelsMatchDetail, parseReelsMatchList, parseReelsResults, reelsFailure, reelsHealthSchema,
  type ReelsError, type ReelsMatchDetail, type ReelsMatchList, type ReelsResultItem,
} from "@/lib/services/reels-schema";
import type { Result } from "@/types/result";

/** Reels okuma servisi istemcisi (Mac, SSH tüneli üzerinden). Şema ve dil kapısı `reels-schema.ts`'te. */

const TIMEOUT_MS = 10_000;

export function isReelsConfigured(): boolean {
  return env.REELS_API_URL.length > 0 && env.REELS_API_KEY.length > 0;
}

const NOT_CONFIGURED: { ok: false; error: ReelsError } = {
  ok: false,
  error: { code: "NOT_CONFIGURED", message: "Reels servisi bağlı değil: REELS_API_URL / REELS_API_KEY tanımlı değil." },
};

async function get(path: string, query: Record<string, string> = {}): Promise<Result<unknown, ReelsError>> {
  if (!isReelsConfigured()) return NOT_CONFIGURED;
  const url = new URL(`/internal/reels${path}`, env.REELS_API_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetchJson(url.toString(), { headers: { "X-Reels-Key": env.REELS_API_KEY }, cache: "no-store" }, { timeoutMs: TIMEOUT_MS, retries: 1 });
  return response.ok ? { ok: true, data: response.data } : { ok: false, error: reelsFailure(response.error) };
}

export async function getReelsHealth(): Promise<Result<boolean, ReelsError>> {
  const response = await get("/health");
  if (!response.ok) return response;
  const parsed = reelsHealthSchema.safeParse(response.data);
  return parsed.success && parsed.data.ok
    ? { ok: true, data: true }
    : { ok: false, error: { code: "CONTRACT", message: "Reels servisi sağlık yanıtı geçersiz." } };
}

export interface ReelsMatchesQuery {
  /** `YYYY-MM-DD`, İstanbul günü. */
  from: string;
  to: string;
  leagues?: readonly number[];
}

export async function getReelsMatches(query: ReelsMatchesQuery): Promise<Result<ReelsMatchList, ReelsError>> {
  const response = await get("/matches", {
    from: query.from,
    to: query.to,
    ...(query.leagues?.length ? { leagues: query.leagues.join(",") } : {}),
  });
  return response.ok ? parseReelsMatchList(response.data) : response;
}

export async function getReelsMatch(matchId: number): Promise<Result<ReelsMatchDetail, ReelsError>> {
  const response = await get(`/match/${matchId}`);
  return response.ok ? parseReelsMatchDetail(response.data) : response;
}

/** `week`: `YYYY-Www`. */
export async function getReelsResults(week: string): Promise<Result<ReelsResultItem[], ReelsError>> {
  const response = await get("/results", { week });
  return response.ok ? parseReelsResults(response.data) : response;
}
