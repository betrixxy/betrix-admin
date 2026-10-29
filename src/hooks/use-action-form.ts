"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { actionFailureMessage, formFileBytes, isNavigationError, requestTooLargeMessage } from "@/lib/dashboard/upload-prep";

/**
 * React 19, form aksiyonu bittiğinde alanları otomatik sıfırlar — hatalı bir gönderimde
 * kullanıcının girdiği veri kaybolur. Bu hook, gönderimi elle bir transition içinde
 * çalıştırarak alanları korur; sıfırlamaya yalnızca çağıran karar verir (ör. başarıda `form.reset()`).
 *
 * Sayfa HİÇBİR hatada çökmez: tek isteğe sığmayan dosyalar gönderilmeden reddedilir; sunucu eylemi istisna
 * ile dönerse (413, gövde sınırı, ağ kopması, zaman aşımı) hata durumun `error` alanına tek satır olarak
 * yazılır (eskiden istisna hata sınırına çıkıp sayfayı "This page couldn't load" ile düşürüyordu).
 */
export function useActionForm<State extends { error?: string | null | undefined }>(
  action: (previousState: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
) {
  const [state, formAction, isPending] = useActionState(async (previous: Awaited<State>, formData: FormData) => {
    try {
      return await action(previous, formData);
    } catch (cause) {
      if (isNavigationError(cause)) throw cause;
      console.error("[action] sunucu eylemi tamamlanamadı:", cause);
      return { ...previous, error: actionFailureMessage(formFileBytes(formData)) } as Awaited<State>;
    }
  }, initialState);
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

  return { state: clientError ? ({ ...state, error: clientError } as Awaited<State>) : state, isPending, onSubmit };
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
      return { ...previous, error: actionFailureMessage(formFileBytes(formData)) } as Awaited<State>;
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
    onError(actionFailureMessage(body ? formFileBytes(body) : 0));
  }
}
