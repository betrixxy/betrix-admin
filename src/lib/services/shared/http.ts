export interface HttpRequestOptions {
  timeoutMs?: number;
  /** 5xx/timeout/ağ hatalarında yapılacak ek deneme sayısı. 4xx hatalarında denenmez. */
  retries?: number;
}

export type HttpFailureKind = "TIMEOUT" | "NETWORK" | "HTTP_STATUS" | "INVALID_JSON";

export interface HttpFailure {
  kind: HttpFailureKind;
  message: string;
  status?: number;
}

export type HttpResult<T> = { ok: true; data: T } | { ok: false; error: HttpFailure };

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;

async function fetchOnce(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<HttpResult<unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: "HTTP_STATUS",
          message: `HTTP ${response.status} ${response.statusText}`,
          status: response.status,
        },
      };
    }

    try {
      return { ok: true, data: (await response.json()) as unknown };
    } catch {
      return {
        ok: false,
        error: { kind: "INVALID_JSON", message: "Yanıt gövdesi JSON olarak ayrıştırılamadı." },
      };
    }
  } catch (cause) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        error: { kind: "TIMEOUT", message: `${timeoutMs}ms içinde yanıt alınamadı.` },
      };
    }
    return {
      ok: false,
      error: {
        kind: "NETWORK",
        message: cause instanceof Error ? cause.message : "Bilinmeyen ağ hatası.",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryable(failure: HttpFailure): boolean {
  if (failure.kind === "TIMEOUT" || failure.kind === "NETWORK") return true;
  return failure.kind === "HTTP_STATUS" && (failure.status ?? 0) >= 500;
}

/** Timeout + retry/backoff'lu, sağlayıcıdan bağımsız düşük seviyeli fetch yardımcısı. */
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  options: HttpRequestOptions = {},
): Promise<HttpResult<unknown>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;

  let attempt = 0;
  let lastResult: HttpResult<unknown>;

  do {
    lastResult = await fetchOnce(url, init, timeoutMs);
    if (lastResult.ok || !isRetryable(lastResult.error)) return lastResult;
    attempt += 1;
  } while (attempt <= retries);

  return lastResult;
}
