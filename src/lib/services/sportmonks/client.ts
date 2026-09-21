import { env } from "@/lib/env";
import { fetchJson, type HttpFailure } from "@/lib/services/shared/http";
import type { SportmonksError } from "@/lib/services/sportmonks/types";
import type { Result } from "@/types/result";

const BASE_URL = "https://api.sportmonks.com/v3/football";

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

  const url = `${BASE_URL}${path}?${new URLSearchParams({
    ...params,
    api_token: env.SPORTMONKS_API_KEY,
  }).toString()}`;

  const result = await fetchJson(url);

  if (!result.ok) {
    return { ok: false, error: mapHttpFailure(result.error) };
  }

  return { ok: true, data: result.data };
}
