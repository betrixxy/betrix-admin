import { env } from "@/lib/env";
import { fetchJson, type HttpFailure } from "@/lib/services/shared/http";
import { TtlCache } from "@/lib/services/shared/ttl-cache";
import type { SportmonksError } from "@/lib/services/sportmonks/types";
import type { Result } from "@/types/result";

const BASE_URL = "https://api.sportmonks.com/v3/football";

/** Varsayılan tazelik — form/istatistik için yeterli (bkz. CLAUDE.md 2.3). Çağıran daraltabilir. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;
/** İstatistik içeren aralık sorguları büyük olabilir. */
const REQUEST_TIMEOUT_MS = 20_000;

const responseCache = new TtlCache<unknown>();

export function isSportmonksConfigured(): boolean {
  return env.SPORTMONKS_API_KEY.length > 0;
}

function mapHttpFailure(failure: HttpFailure): SportmonksError {
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
 * Sportmonks v3 için tekli, doğrulanmış istek katmanı — kimlik doğrulama (`api_token`
 * query param), timeout ve retry/backoff yalnızca burada yaşar (bkz. CLAUDE.md 1.4).
 * Ham JSON'u döndürür; şema doğrulama çağıran fonksiyonun (bkz. team-form.ts)
 * sorumluluğundadır.
 */
export async function sportmonksRequest(
  path: string,
  params: Record<string, string> = {},
  options: { ttlMs?: number } = {},
): Promise<Result<unknown, SportmonksError>> {
  if (!isSportmonksConfigured()) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "SPORTMONKS_API_KEY tanımlı değil — .env.local dosyasını doldurun.",
      },
    };
  }

  // Önbellek anahtarı token içermez; token yalnızca istek URL'ine eklenir, loglanmaz.
  const cacheKey = `${path}?${new URLSearchParams(params).toString()}`;
  const cached = responseCache.get(cacheKey);
  if (cached !== undefined) return { ok: true, data: cached };

  const url = `${BASE_URL}${path}?${new URLSearchParams({
    ...params,
    api_token: env.SPORTMONKS_API_KEY,
  }).toString()}`;

  const result = await fetchJson(url, {}, { timeoutMs: REQUEST_TIMEOUT_MS });

  if (!result.ok) {
    return { ok: false, error: mapHttpFailure(result.error) };
  }

  // Hatalar asla önbelleğe alınmaz — yalnızca başarılı yanıtlar.
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  if (ttlMs > 0) responseCache.set(cacheKey, result.data, ttlMs);
  return { ok: true, data: result.data };
}
