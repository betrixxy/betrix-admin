import { X_PRICE_USD } from "@/lib/services/social/x-budget";

/**
 * X gönderi metriklerini hangi yoldan okumalı — saf fonksiyonlar (bkz. CLAUDE.md 4.5).
 * - Zaman akışı (`/2/users/:id/tweets`, owned read $0.001/gönderi): penceredeki TÜM gönderiler döner.
 * - Kimlik sorgusu (`/2/tweets?ids=`, $0.005/gönderi): yalnızca istenenler.
 * Pencere küçük ve yoğunsa zaman akışı, seyrek ve geniş pencerede kimlik sorgusu ucuzdur.
 */

export type XReadPath = "timeline" | "ids";

/** `windowCount`: penceredeki (kayıtlı) gönderi sayısı, `dueCount`: çekilmesi gereken gönderi sayısı. */
export function chooseXReadPath(dueCount: number, windowCount: number): XReadPath {
  return windowCount * X_PRICE_USD.ownedPostRead <= dueCount * X_PRICE_USD.postRead ? "timeline" : "ids";
}

/** `non_public_metrics`/`organic_metrics` yalnızca son 30 günün gönderilerinde döner; sınırın hemen altında kesilir. */
export const X_PRIVATE_METRICS_MAX_AGE_MS = 29.5 * 24 * 3_600_000;

export function splitByPrivateWindow<T extends { publishedAt: Date }>(posts: readonly T[], now: Date): { recent: T[]; old: T[] } {
  const recent: T[] = [];
  const old: T[] = [];
  for (const post of posts) (now.getTime() - post.publishedAt.getTime() <= X_PRIVATE_METRICS_MAX_AGE_MS ? recent : old).push(post);
  return { recent, old };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}
