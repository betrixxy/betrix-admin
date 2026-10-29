/**
 * Arka plan stüdyo işi (bkz. `lib/jobs/studio-jobs.ts`): uzun üretimler (Fal büyütme, çizim, AI gerekçe)
 * Cloudflare'in ~100 sn yanıt sınırına takılmasın diye istekten ayrılır — eylem iş kimliğini hemen döner,
 * stüdyo birkaç saniyede bir durumu sorar.
 */

/** Eylemin hemen döndürdüğü iş. `reused`: aynı iş zaten çalışıyordu, yenisi başlatılmadı. */
export interface StudioJobStart {
  jobId: string;
  reused: boolean;
}

export type StudioJobView<T = unknown> =
  | { status: "running"; step: string; elapsedMs: number }
  | { status: "done"; value: T; elapsedMs: number }
  /** Sunucu yeniden başladı (deploy) ya da iş 30 dk'dan eski — sonuç bilinmiyor. */
  | { status: "missing" };

/** Durum sorgusu aralığı (ms). */
export const STUDIO_JOB_POLL_MS = 2000;
