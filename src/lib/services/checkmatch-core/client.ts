import { env } from "@/lib/env";
import { fetchJson, type HttpFailure } from "@/lib/services/shared/http";
import type { CheckmatchCoreError } from "@/lib/services/checkmatch-core/types";
import type { Result } from "@/types/result";

/** Yerel ağdaki Mac sunucusu — genel internet gecikmesine kıyasla düşük timeout yeterli. */
const DEFAULT_TIMEOUT_MS = 5000;
/** Sunucu FAZ 5'te yeni devreye alındığı için ek dayanıklılık amacıyla standarttan (1) daha yüksek. */
const DEFAULT_RETRIES = 2;

export function isCheckmatchCoreConfigured(): boolean {
  return env.CHECKMATCH_MAC_SERVER_URL.length > 0 && env.CHECKMATCH_API_SECRET.length > 0;
}

function mapHttpFailure(failure: HttpFailure): CheckmatchCoreError {
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
 * Mac sunucusu (checkmatch-core) için tekli, doğrulanmış istek katmanı — taban URL,
 * timeout ve retry/backoff yalnızca burada yaşar (bkz. CLAUDE.md 1.4). Ham JSON'u
 * döndürür; şema doğrulama ve tip daraltma çağıran fonksiyonun (bkz. market-calculations.ts)
 * sorumluluğundadır.
 */
export async function checkmatchCoreRequest(
  path: string,
  params: Record<string, string> = {},
): Promise<Result<unknown, CheckmatchCoreError>> {
  if (!isCheckmatchCoreConfigured()) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message:
          "CHECKMATCH_MAC_SERVER_URL veya CHECKMATCH_API_SECRET tanımlı değil — .env.local dosyasını doldurun.",
      },
    };
  }

  const query = new URLSearchParams(params).toString();
  const url = `${env.CHECKMATCH_MAC_SERVER_URL}${path}${query ? `?${query}` : ""}`;

  const result = await fetchJson(
    url,
    {
      headers: {
        Accept: "application/json",
        // Service-to-service VIP token — canlı sitedeki paywall'ı CRM panosu için aşar.
        "x-api-key": env.CHECKMATCH_API_SECRET,
      },
    },
    { timeoutMs: DEFAULT_TIMEOUT_MS, retries: DEFAULT_RETRIES },
  );

  if (!result.ok) {
    return { ok: false, error: mapHttpFailure(result.error) };
  }

  return { ok: true, data: result.data };
}
