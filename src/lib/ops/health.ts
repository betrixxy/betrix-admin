/**
 * Dış izleme için sağlık yanıtı (bkz. CLAUDE.md 1.9). Oturumsuzdur, bu yüzden yanıtta yalnızca sabit durum
 * değerleri bulunur: hata metni, sürüm, ortam ya da bağlantı bilgisi dönmez. Hata metni günlüğe de yazılmaz,
 * çünkü veritabanı istemcisinin mesajı bağlantı adresini içerebilir.
 */

export const HEALTH_DB_TIMEOUT_MS = 3_000;

export interface HealthDeps {
  /** Veritabanına en küçük sorguyu gönderir; bağlantı yoksa reddedilir. */
  pingDatabase: () => Promise<unknown>;
  timeoutMs?: number;
  logFailure?: (errorName: string) => void;
}

const TIMEOUT_ERROR = "HealthTimeout";

function withTimeout(task: Promise<unknown>, timeoutMs: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(TIMEOUT_ERROR);
      error.name = TIMEOUT_ERROR;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

export function createHealthHandler(deps: HealthDeps): () => Promise<Response> {
  const timeoutMs = deps.timeoutMs ?? HEALTH_DB_TIMEOUT_MS;
  const logFailure = deps.logFailure ?? ((name: string) => console.error(`[health] veritabanı yanıt vermedi: ${name}`));

  return async () => {
    let healthy = true;
    try {
      // pingDatabase'in eşzamanlı hatası da aynı dala düşsün diye çağrı try içinde.
      await withTimeout(deps.pingDatabase(), timeoutMs);
    } catch (error) {
      healthy = false;
      logFailure(error instanceof Error ? error.name : "UnknownError");
    }
    return Response.json(
      healthy ? { status: "ok", db: "ok" } : { status: "error", db: "error" },
      { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  };
}
