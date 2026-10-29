import { MAX_UPLOAD_BYTES } from "@/lib/dashboard/image-limits";

/**
 * Tarayıcıda yükleme öncesi görsel hazırlığının saf kuralları (istemci ve test ortak; DOM yok).
 *
 * Neden tarayıcıda küçültme (sınırı artırmak yerine): sunucu görseli tek parça belleğe alır (Next
 * gövdeyi `proxy.ts` katmanında 20 MB'ta keser, Caddy 25 MB'ta 413 döner; sharp 40+ MP JPEG'i çözmek için
 * yüzlerce MB ister). Sınırı büyütmek belleği ve isteğin ağdaki süresini büyütür; kartın ihtiyacı ise
 * kısa kenar ≥ 2000 px'tir. Bu yüzden ORİJİNAL baytlar korunur (arşiv kuralı: yeniden sıkıştırma yok) —
 * YALNIZCA sunucunun kabul etmeyeceği dosya (8 MB üstü ya da uzun kenarı 6000 px'ten büyük) tarayıcıda
 * 6000 px'e sığdırılıp yüksek kalitede yeniden kodlanır; kart kalitesine etkisi yoktur.
 */

/** Uzun kenar bundan büyükse küçültülür (6000×4000 = 24 MP; kart kısa kenar 2000 px ister). */
export const CLIENT_MAX_LONG_SIDE = 6000;
/** Hedef dosya boyutu: sunucu sınırının biraz altı (kodlayıcı payı). */
export const CLIENT_TARGET_BYTES = Math.floor(MAX_UPLOAD_BYTES * 0.95);
/**
 * Kalite yetmezse denenen uzun kenarlar (sırayla). 3200 px’te 3:2 fotoğrafın kısa kenarı 2133 — kartın
 * istediği 2000 px’in üstünde kalır.
 */
export const CLIENT_LONG_SIDE_STEPS = [6000, 5000, 4000, 3200] as const;
/** Denenen JPEG/WebP kaliteleri — ilk sınıra sığan kullanılır. */
export const CLIENT_QUALITIES = [0.92, 0.86, 0.8, 0.72] as const;
/**
 * Bir formun tek istekte gönderebileceği toplam dosya baytı: Next `proxy.ts` gövde sınırı (20 MB) ve Caddy
 * (25 MB) altında kalır; aşan form gönderilmez, sebep yazılır (sayfa çökmez).
 */
export const SAFE_REQUEST_BYTES = 19 * 1024 * 1024;

export interface UploadPlan {
  /** false → dosya olduğu gibi gönderilir (orijinal baytlar). */
  resize: boolean;
  width: number;
  height: number;
}

/** Dosya boyutu ve piksel ölçüsünden karar: küçültme gerekir mi, hedef ölçü ne. */
export function planUpload(bytes: number, width: number, height: number): UploadPlan {
  const longSide = Math.max(width, height);
  if (bytes <= MAX_UPLOAD_BYTES && longSide <= CLIENT_MAX_LONG_SIDE) return { resize: false, width, height };
  const scale = Math.min(1, CLIENT_MAX_LONG_SIDE / longSide);
  return { resize: true, width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;

/** Formdaki dosyaların toplam baytı (FormData'daki File'lar). */
export function formFileBytes(formData: FormData): number {
  let total = 0;
  for (const value of formData.values()) if (typeof value === "object" && value !== null && "size" in value) total += (value as Blob).size;
  return total;
}

/** Toplam dosya boyutu tek isteğe sığmıyorsa kullanıcıya gösterilecek tek satır; sığıyorsa null. */
export function requestTooLargeMessage(totalBytes: number): string | null {
  if (totalBytes <= SAFE_REQUEST_BYTES) return null;
  return `Seçilen dosyalar toplam ${formatMegabytes(totalBytes)} — tek seferde en fazla ${formatMegabytes(SAFE_REQUEST_BYTES)} gönderilebilir. Fotoğrafı yeniden seçin (büyük fotoğraf otomatik küçültülür) ya da daha küçük bir dosya kullanın.`;
}

/** Next yönlendirmesi/notFound (sunucu eylemi `redirect()` etti) — yakalanmaz, yeniden fırlatılır. */
export function isNavigationError(cause: unknown): boolean {
  const digest = typeof cause === "object" && cause !== null && "digest" in cause ? String((cause as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND";
}

/** Sunucu eylemi istisna ile döndüğünde (413, gövde sınırı, ağ kopması, zaman aşımı) gösterilecek tek satır. */
export function actionFailureMessage(totalBytes: number): string {
  return (
    requestTooLargeMessage(totalBytes) ??
    "Sunucu isteği tamamlayamadı (bağlantı koptu ya da yanıt alınamadı) — form ve seçtiğiniz fotoğraf korunuyor, tekrar deneyin."
  );
}
