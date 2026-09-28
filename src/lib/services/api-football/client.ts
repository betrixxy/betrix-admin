import { env } from "@/lib/env";
import { fetchJson, type HttpFailure } from "@/lib/services/shared/http";
import { TtlCache } from "@/lib/services/shared/ttl-cache";
import { apiFootballErrorsEnvelopeSchema, type ApiFootballError } from "@/lib/services/api-football/types";
import type { Result } from "@/types/result";

const BASE_URL = "https://v3.football.api-sports.io";

/** Varsayılan tazelik: fikstür listesi için yeterli (bkz. CLAUDE.md 2.3). Çağıran daraltabilir. */
const DEFAULT_TTL_MS = 15 * 60 * 1000;

const responseCache = new TtlCache<unknown>();

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

/** HTTP 200 gövdesindeki `errors` alanını okur — doluysa mesajları birleştirip döndürür. */
function readEnvelopeError(data: unknown): string | null {
  const parsed = apiFootballErrorsEnvelopeSchema.safeParse(data);
  if (!parsed.success || !parsed.data.errors) return null;
  const messages = Array.isArray(parsed.data.errors)
    ? parsed.data.errors.map(String)
    : Object.entries(parsed.data.errors).map(([field, message]) => `${field}: ${String(message)}`);
  return messages.length > 0 ? messages.join("; ") : null;
}

export interface ApiFootballRequestOptions {
  /** Başarılı yanıtın süreç içi önbellekte tutulma süresi. 0 → önbelleğe alınmaz. */
  ttlMs?: number;
}

/**
 * API-Football v3 için tekli, doğrulanmış istek katmanı — kimlik doğrulama, timeout,
 * retry/backoff ve önbellek yalnızca burada yaşar (bkz. CLAUDE.md 1.4). Ham JSON'u döndürür;
 * şema doğrulama ve tip daraltma çağıran fonksiyonun (bkz. fixtures.ts) sorumluluğundadır.
 */
export async function apiFootballRequest(
  path: string,
  params: Record<string, string>,
  options: ApiFootballRequestOptions = {},
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
  const cached = responseCache.get(url);
  if (cached !== undefined) return { ok: true, data: cached };

  const result = await fetchJson(url, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY },
  });

  if (!result.ok) {
    return { ok: false, error: mapHttpFailure(result.error) };
  }

  const envelopeError = readEnvelopeError(result.data);
  if (envelopeError) {
    return { ok: false, error: { code: "API_ERROR", message: `API-Football: ${envelopeError}` } };
  }

  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  if (ttlMs > 0) responseCache.set(url, result.data, ttlMs);
  return { ok: true, data: result.data };
}
