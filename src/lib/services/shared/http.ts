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
const RETRY_BACKOFF_MS = 1000;

function timeoutFailure(timeoutMs: number, phase: string): HttpResult<never> {
  return { ok: false, error: { kind: "TIMEOUT", message: `${timeoutMs}ms içinde tamamlanamadı (${phase}).` } };
}

/**
 * Node/undici ağ hataları yalnızca "fetch failed" der; asıl neden `cause` içindedir
 * (ör. ECONNRESET, ENOTFOUND, UND_ERR_CONNECT_TIMEOUT). Teşhis için mesaja eklenir.
 */
function describeNetworkError(cause: unknown): string {
  if (!(cause instanceof Error)) return "Bilinmeyen ağ hatası.";
  const inner: unknown = cause.cause;
  if (inner instanceof Error) {
    const code = "code" in inner && typeof inner.code === "string" ? inner.code : inner.name;
    return `${cause.message} (${code}: ${inner.message})`;
  }
  return cause.message;
}

const ERROR_MESSAGE_MAX = 300;

async function readJsonOrNull(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * 2xx dışı yanıt gövdesinden yalnızca sağlayıcının hata nesnesindeki tanı alanlarını çıkarır
 * (Meta Graph: `{ error: { type, code, error_subcode, fbtrace_id, message } }`). Gövdenin tamamı
 * asla mesaja girmez; `message` ilk 300 karakterle sınırlanır. Tanınan alan yoksa `null`.
 */
export function describeErrorBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error: unknown = body.error;
  if (typeof error !== "object" || error === null) return null;

  const scalar = (key: string): string | null => {
    const value: unknown = key in error ? (error as Record<string, unknown>)[key] : undefined;
    return typeof value === "string" || typeof value === "number" ? String(value) : null;
  };
  const parts: string[] = [];
  for (const key of ["type", "code", "error_subcode", "fbtrace_id"]) {
    const value = scalar(key);
    if (value !== null) parts.push(`${key}=${value}`);
  }
  const message = scalar("message");
  if (message !== null) parts.push(`message=${JSON.stringify(message.replace(/\s+/g, " ").slice(0, ERROR_MESSAGE_MAX))}`);
  return parts.length > 0 ? parts.join(" ") : null;
}

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
      const detail = describeErrorBody(await readJsonOrNull(response));
      return {
        ok: false,
        error: {
          kind: "HTTP_STATUS",
          message: `HTTP ${response.status} ${response.statusText}${detail ? ` (${detail})` : ""}`,
          status: response.status,
        },
      };
    }

    try {
      return { ok: true, data: (await response.json()) as unknown };
    } catch {
      // Zaman aşımı gövde indirilirken de dolabilir (büyük yanıtlar) — bu bir JSON hatası
      // değil, yeniden denenebilir bir TIMEOUT'tur.
      if (controller.signal.aborted) return timeoutFailure(timeoutMs, "gövde indirilirken");
      return {
        ok: false,
        error: { kind: "INVALID_JSON", message: "Yanıt gövdesi JSON olarak ayrıştırılamadı." },
      };
    }
  } catch (cause) {
    if (controller.signal.aborted) return timeoutFailure(timeoutMs, "yanıt beklenirken");
    return { ok: false, error: { kind: "NETWORK", message: describeNetworkError(cause) } };
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
    // Geçici ağ/yük sorunlarında hemen tekrar vurmak yerine artan bekleme (1 sn, 2 sn, …).
    if (attempt <= retries) await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * attempt));
  } while (attempt <= retries);

  return lastResult;
}
