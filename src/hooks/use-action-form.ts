"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { pollStudioJobAction } from "@/app/dashboard/studio/job-actions";
import { awaitJob } from "@/lib/jobs/await-job";
import { settleJobState, visibleJobState } from "@/lib/jobs/job-state";
import { actionFailureMessage, formFileBytes, isNavigationError, requestTooLargeMessage } from "@/lib/dashboard/upload-prep";
import type { StudioJobStart, StudioJobView } from "@/types/studio-job";

/** Çalışan arka plan işinin adımı — "Fotoğraf büyütülüyor (Fal ESRGAN) · 14 sn". */
export interface JobProgress {
  step: string;
  elapsedMs: number;
}

/**
 * Arka plan işini bekler (bkz. `lib/jobs/studio-jobs.ts`). İşin değeri eylemin kendi dönüş tipidir; sunucu
 * yalnızca o tipte değer saklar (`startStudioJob<T>`), istemci aynı eylemin işini sorduğu için daraltma güvenlidir.
 */
export function pollJob<T>(jobId: string): Promise<StudioJobView<T>> {
  return pollStudioJobAction(jobId) as Promise<StudioJobView<T>>;
}

type JobState = { error?: string | null | undefined; job?: StudioJobStart | undefined };

export interface JobFormOptions<State> {
  /** Başarılı sonuçta gidilecek adres (ör. üretilen taslak); null → sayfada kalınır. */
  successHref?: (state: State) => string | null;
}

/**
 * `useActionState` + arka plan işi: eylem `job` dönerse iş bitene kadar beklenir (`isPending` sürer,
 * `progress` adımı verir), sonuç işin değeridir. Eylem istisnası sayfayı düşürmez, `error`a tek satır yazılır.
 * Gönderim sürerken önceki denemenin hatası gösterilmez; `successHref` verilirse başarıda oraya gidilir
 * (kurallar saf: `lib/jobs/job-state.ts`).
 */
export function useJobActionState<State extends JobState>(
  action: (previousState: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  options: JobFormOptions<Awaited<State>> = {},
) {
  const router = useRouter();
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [state, formAction, isPending] = useActionState(async (previous: Awaited<State>, formData: FormData) => {
    const tooLarge = requestTooLargeMessage(formFileBytes(formData));
    if (tooLarge) return { ...previous, job: undefined, error: tooLarge } as Awaited<State>;
    try {
      const started = await action(previous, formData);
      if (!started.job) return started;
      setProgress({ step: started.job.reused ? "Bu iş zaten çalışıyor — sonucu bekleniyor" : "Başlatıldı", elapsedMs: 0 });
      const done = await awaitJob(started.job.jobId, pollJob<Awaited<State>>, (step, elapsedMs) => setProgress({ step, elapsedMs }));
      const settled = settleJobState(previous, done, options.successHref);
      if (settled.href) router.push(settled.href);
      return settled.state;
    } catch (cause) {
      if (isNavigationError(cause)) throw cause;
      console.error("[action] sunucu eylemi tamamlanamadı:", cause);
      return { ...previous, job: undefined, error: actionFailureMessage(formFileBytes(formData), cause) } as Awaited<State>;
    } finally {
      setProgress(null);
    }
  }, initialState);
  return [visibleJobState(state, isPending), formAction, isPending, progress] as const;
}

/**
 * React 19, form aksiyonu bittiğinde alanları otomatik sıfırlar — hatalı bir gönderimde
 * kullanıcının girdiği veri kaybolur. Bu hook, gönderimi elle bir transition içinde
 * çalıştırarak alanları korur; sıfırlamaya yalnızca çağıran karar verir (ör. başarıda `form.reset()`).
 *
 * Sayfa HİÇBİR hatada çökmez: tek isteğe sığmayan dosyalar gönderilmeden reddedilir; sunucu eylemi istisna
 * ile dönerse (413, gövde sınırı, ağ kopması, eski sürüm sayfası) hata durumun `error` alanına tek satır olarak
 * yazılır (eskiden istisna hata sınırına çıkıp sayfayı "This page couldn't load" ile düşürüyordu).
 *
 * Eylem `job` dönerse (uzun üretim arka planda) iş bitene kadar beklenir — `isPending` sürer, `progress` adımı
 * gösterir; sonuç işin değeridir.
 */
export function useActionForm<State extends JobState>(
  action: (previousState: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  options: JobFormOptions<Awaited<State>> = {},
) {
  const [state, formAction, isPending, progress] = useJobActionState(action, initialState, options);
  const [, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const tooLarge = requestTooLargeMessage(formFileBytes(formData));
    setClientError(tooLarge);
    if (tooLarge) return;
    startTransition(() => formAction(formData));
  }

  return { state: clientError ? ({ ...state, error: clientError } as Awaited<State>) : state, isPending, onSubmit, progress };
}

/**
 * `useActionState`'in çökmeyen hâli (gönderimi çağıran yönetir, ör. önizleme düğmesi): eylem istisna ile
 * dönerse `error` alanına tek satır yazılır, sayfa çökmez.
 */
export function useSafeActionState<State extends { error?: string | null | undefined }>(
  action: (previousState: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
) {
  return useActionState(async (previous: Awaited<State>, formData: FormData) => {
    const tooLarge = requestTooLargeMessage(formFileBytes(formData));
    if (tooLarge) return { ...previous, error: tooLarge } as Awaited<State>;
    try {
      return await action(previous, formData);
    } catch (cause) {
      if (isNavigationError(cause)) throw cause;
      console.error("[action] sunucu eylemi tamamlanamadı:", cause);
      return { ...previous, error: actionFailureMessage(formFileBytes(formData), cause) } as Awaited<State>;
    }
  }, initialState);
}

/**
 * Elle çağrılan eylem görevleri için (`startTransition(async () => …)`): görev istisna ile biterse sayfa
 * çökmez, `onError` tek satırla çağrılır. `body` verilirse mesaj gönderilen dosya boyutunu da söyler.
 */
export async function runGuarded(task: () => Promise<void>, onError: (message: string) => void, body?: FormData): Promise<void> {
  try {
    await task();
  } catch (cause) {
    if (isNavigationError(cause)) throw cause;
    console.error("[action] sunucu eylemi tamamlanamadı:", cause);
    onError(actionFailureMessage(body ? formFileBytes(body) : 0, cause));
  }
}

/**
 * `Result` döndüren eylemler için (Vitrin, Kahraman Liste, Oyuncu Karşılaştırması): eylem işi başlatır,
 * burada bitene kadar beklenir; sonuç işin `Result`'ıdır.
 */
export async function resultFromJob<T>(
  started: { ok: true; data: StudioJobStart } | { ok: false; error: { code: string; message: string } },
  onProgress: (progress: JobProgress | null) => void,
): Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }> {
  if (!started.ok) return started;
  onProgress({ step: started.data.reused ? "Bu iş zaten çalışıyor — sonucu bekleniyor" : "Başlatıldı", elapsedMs: 0 });
  try {
    const done = await awaitJob(started.data.jobId, pollJob<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }>, (step, elapsedMs) => onProgress({ step, elapsedMs }));
    return done.ok ? done.value : { ok: false, error: { code: "JOB_LOST", message: done.message } };
  } finally {
    onProgress(null);
  }
}
