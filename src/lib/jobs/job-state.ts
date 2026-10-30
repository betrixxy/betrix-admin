import type { AwaitedJob } from "@/lib/jobs/await-job";

/**
 * Stüdyo form durumunun saf kuralları (`hooks/use-action-form.ts` kullanır; birim test edilir).
 *
 * Tekrar denemede eski hata (2026-10-30, Maç Sonucu): `useActionState` durumu yalnızca eylem BİTİNCE
 * değiştirir — yeni iş 1–2 dk sürerken önceki denemenin hatası ("keskinlik 2 < 45") "Üretiliyor…"
 * düğmesinin yanında kalıyordu; başarıdan sonra da sayfa taslağa geçmiyordu (sonuç yalnızca sağdaki,
 * dar ekranda formun altında kalan önizlemede). Kural: (1) gönderim sürerken önceki hata gösterilmez;
 * (2) iş başarıyla biterse çağıranın verdiği hedefe (taslak) gidilir; (3) başarısızlıkta hata yazılır.
 */

export type JobFormState = { error?: string | null | undefined; job?: unknown };

/** Ekranda gösterilecek durum: gönderim sürerken önceki denemenin hatası gizlenir. */
export function visibleJobState<S extends JobFormState>(state: S, isPending: boolean): S {
  return isPending && state.error ? { ...state, error: undefined } : state;
}

/**
 * İşin sonucu → yeni form durumu + (başarıda) gidilecek adres. Başarı: işin değeri olduğu gibi (önceki
 * hata/sonuç taşınmaz); başarısızlık: önceki durum + bu denemenin mesajı.
 */
export function settleJobState<S extends JobFormState>(previous: S, done: AwaitedJob<S>, successHref?: (state: S) => string | null): { state: S; href: string | null } {
  if (!done.ok) return { state: { ...previous, job: undefined, error: done.message }, href: null };
  const href = done.value.error ? null : (successHref?.(done.value) ?? null);
  return { state: done.value, href };
}
