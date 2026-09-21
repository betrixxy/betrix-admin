import { env } from "@/lib/env";
import { fetchJson, type HttpFailure } from "@/lib/services/shared/http";
import type { ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

const BASE_URL = "https://v3.football.api-sports.io";

export function isApiFootballConfigured(): boolean {
  return env.API_FOOTBALL_KEY.length > 0;
}

function mapHttpFailure(failure: HttpFailure): ApiFootballError {
  switch (failure.kind) {
    case "TIMEOUT":
      return { code: "TIMEOUT", message: failure.message };
    case "NETWORK":
      return { code: "NETWORK", message: failure.message };
    case "HTTP_STATUS":
      return { code: "HTTP_STATUS", message: failure.message, status: failure.status };
    case "INVALID_JSON":
      return { code: "INVALID_RESPONSE", message: failure.message };
  }
}

/**
 * API-Football v3 için tekli, doğrulanmış istek katmanı — kimlik doğrulama, timeout ve
 * retry/backoff yalnızca burada yaşar (bkz. CLAUDE.md 1.4). Ham JSON'u döndürür; şema
 * doğrulama ve tip daraltma çağıran fonksiyonun (bkz. fixtures.ts) sorumluluğundadır.
 */
export async function apiFootballRequest(
  path: string,
  params: Record<string, string>,
): Promise<Result<unknown, ApiFootballError>> {
  if (!isApiFootballConfigured()) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "API_FOOTBALL_KEY tanımlı değil — .env.local dosyasını doldurun.",
      },
    };
  }

  const url = `${BASE_URL}${path}?${new URLSearchParams(params).toString()}`;
  const result = await fetchJson(url, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY },
  });

  if (!result.ok) {
    return { ok: false, error: mapHttpFailure(result.error) };
  }

  return { ok: true, data: result.data };
}
