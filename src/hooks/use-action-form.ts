"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * React 19, form aksiyonu bittiğinde alanları otomatik sıfırlar — hatalı bir gönderimde
 * kullanıcının girdiği veri kaybolur. Bu hook, gönderimi elle bir transition içinde
 * çalıştırarak alanları korur; sıfırlamaya yalnızca çağıran karar verir (ör. başarıda `form.reset()`).
 */
export function useActionForm<State extends object>(
  action: (previousState: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { state, isPending, onSubmit };
}
