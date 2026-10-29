import { STUDIO_JOB_POLL_MS, type StudioJobView } from "@/types/studio-job";

/** Saf bekleme döngüsü (istemci + test): iş bitene kadar `poll` eder, adımı `onStep`'e verir. */
export type AwaitedJob<T> = { ok: true; value: T } | { ok: false; message: string };

export const JOB_MISSING_MESSAGE = "Üretim işi sunucuda bulunamadı (sunucu yeniden başlamış olabilir) — taslak oluştuysa Maç Merkezi'nde görünür; yoksa tekrar deneyin.";
export const JOB_POLL_FAILED_MESSAGE = "Üretim durumu alınamadı (bağlantı) — iş sunucuda sürüyor olabilir; taslaklara bakın ya da tekrar deneyin.";

export async function awaitJob<T>(
  jobId: string,
  poll: (jobId: string) => Promise<StudioJobView<T>>,
  onStep: (step: string, elapsedMs: number) => void,
  options: { intervalMs?: number; sleep?: (ms: number) => Promise<void>; maxPollFailures?: number } = {},
): Promise<AwaitedJob<T>> {
  const intervalMs = options.intervalMs ?? STUDIO_JOB_POLL_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxFailures = options.maxPollFailures ?? 5;
  let failures = 0;
  for (;;) {
    let view: StudioJobView<T>;
    try {
      view = await poll(jobId);
      failures = 0;
    } catch {
      // Tek bir kopuk sorgu işi bitirmez; art arda birkaç başarısızlıktan sonra vazgeçilir.
      failures += 1;
      if (failures >= maxFailures) return { ok: false, message: JOB_POLL_FAILED_MESSAGE };
      await sleep(intervalMs);
      continue;
    }
    if (view.status === "done") return { ok: true, value: view.value };
    if (view.status === "missing") return { ok: false, message: JOB_MISSING_MESSAGE };
    onStep(view.step, view.elapsedMs);
    await sleep(intervalMs);
  }
}
