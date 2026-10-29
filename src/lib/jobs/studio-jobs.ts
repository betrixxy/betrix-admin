import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { StudioJobStart, StudioJobView } from "@/types/studio-job";

/**
 * Bellek içi arka plan işleri (tek uygulama örneği — bkz. CLAUDE.md 1.9). Her iş bir admin tıklamasıyla
 * başlar (1.10: kendi kendine üretim yok); eylem iş kimliğini hemen döner, iş istekten bağımsız sürer —
 * sayfa kapansa da biter ve DRAFT yazılır. Aynı anahtarla çalışan iş varsa yenisi başlatılmaz.
 * Sunucu yeniden başlarsa (deploy) çalışan iş kaybolur; stüdyo "missing" görür ve anlaşılır hata yazar.
 */

interface JobRecord {
  id: string;
  kind: string;
  key: string;
  step: string;
  startedAt: number;
  stepAt: number;
  finishedAt: number | null;
  value: unknown;
}

/** Bir işin üst süresi: Fal zaman sınırları (≤150 sn/çağrı) + çizim; aşılırsa iş "zaman aşımı" ile biter. */
export const STUDIO_JOB_TIMEOUT_MS = 8 * 60_000;
/** Biten iş bu kadar süre sorgulanabilir. */
const FINISHED_TTL_MS = 30 * 60_000;

const globalJobs = globalThis as typeof globalThis & { __studioJobs?: Map<string, JobRecord> };
const jobs = (globalJobs.__studioJobs ??= new Map<string, JobRecord>());
const current = new AsyncLocalStorage<JobRecord>();

function purge(now: number): void {
  for (const [id, job] of jobs) if (job.finishedAt !== null && now - job.finishedAt > FINISHED_TTL_MS) jobs.delete(id);
}

/**
 * Çalışan işin adımını yazar ("Fotoğraf büyütülüyor (Fal ESRGAN)"); iş dışında (offline araç, test) etkisizdir.
 * Her adım günlüğe süresiyle düşer — teşhis için hangi adımda ne kadar beklendiği görünür.
 */
export function reportJobStep(step: string): void {
  const job = current.getStore();
  if (!job || job.finishedAt !== null) return;
  const now = Date.now();
  console.info(`[job] ${job.kind} ${job.id.slice(0, 8)} "${job.step}" ${now - job.stepAt} ms → "${step}"`);
  job.step = step;
  job.stepAt = now;
}

export interface StartStudioJobInput<T> {
  /** Günlük etiketi: "match-result", "match-day"… */
  kind: string;
  /** Aynı işi ikinci kez başlatmamak için: tür + maç + format… */
  key: string;
  firstStep: string;
  run: () => Promise<T>;
  /** İş istisna ile ya da süre aşımıyla biterse dönecek değer (eylemin hata biçiminde). */
  fail: (message: string) => T;
  timeoutMs?: number;
}

export function startStudioJob<T>(input: StartStudioJobInput<T>): StudioJobStart {
  const now = Date.now();
  purge(now);
  for (const job of jobs.values()) if (job.key === input.key && job.finishedAt === null) return { jobId: job.id, reused: true };

  const job: JobRecord = { id: randomUUID(), kind: input.kind, key: input.key, step: input.firstStep, startedAt: now, stepAt: now, finishedAt: null, value: null };
  jobs.set(job.id, job);
  const timeoutMs = input.timeoutMs ?? STUDIO_JOB_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(input.fail(`İş ${Math.round(timeoutMs / 1000)} sn içinde bitmedi (son adım: ${job.step}) — tekrar deneyin.`)), timeoutMs);
  });
  const work = current.run(job, async () => {
    try {
      return await input.run();
    } catch (cause) {
      console.error(`[job] ${job.kind} ${job.id.slice(0, 8)} "${job.step}" adımında istisna:`, cause);
      return input.fail(`Üretim "${job.step}" adımında tamamlanamadı — tekrar deneyin.`);
    }
  });
  void Promise.race([work, timeout]).then((value) => {
    clearTimeout(timer);
    const end = Date.now();
    job.value = value;
    job.finishedAt = end;
    console.info(`[job] ${job.kind} ${job.id.slice(0, 8)} "${job.step}" ${end - job.stepAt} ms → bitti, toplam ${end - job.startedAt} ms`);
  });
  return { jobId: job.id, reused: false };
}

export function studioJobView(jobId: string): StudioJobView {
  const job = jobs.get(jobId);
  if (!job) return { status: "missing" };
  const end = job.finishedAt ?? Date.now();
  return job.finishedAt === null ? { status: "running", step: job.step, elapsedMs: end - job.startedAt } : { status: "done", value: job.value, elapsedMs: end - job.startedAt };
}

/** `Result` döndüren üretimler için (Vitrin, Kahraman Liste, Oyuncu Karşılaştırması): hata `JOB_FAILED` olur. */
export function startResultJob<T>(
  kind: string,
  key: string,
  firstStep: string,
  run: () => Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }>,
): { ok: true; data: StudioJobStart } {
  return { ok: true, data: startStudioJob({ kind, key, firstStep, run, fail: (message) => ({ ok: false as const, error: { code: "JOB_FAILED", message } }) }) };
}
