import type { PostMediaType } from "@/types/social";

/**
 * Gönderi metriklerinin kademeli çekim takvimi (bkz. CLAUDE.md 4.4): yayından 1 sa, 6 sa, 24 sa, 72 sa,
 * 7 g ve 30 g sonra. Story metrikleri Meta'da 24 saat tutulduğu için story takvimi 1/6/23 sa'dir.
 * 30 günden (story'de 24 saatten) eski gönderiler otomatik çekilmez. Saf fonksiyonlar.
 */

const HOUR_MS = 3_600_000;

export interface Checkpoint {
  label: string;
  hours: number;
}

export const POST_CHECKPOINTS: readonly Checkpoint[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "72h", hours: 72 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

export const STORY_CHECKPOINTS: readonly Checkpoint[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "23h", hours: 23 },
];

/**
 * Son kontrol noktası geçtikten sonra çekime tanınan pay — saatlik tetikleyicinin gecikmesi ya da kısa bir
 * kesinti yüzünden 30 g / 23 sa ölçümü kaybolmasın. Bu payın dışında kalan gönderi otomatik çekilmez.
 */
export const FINAL_CHECKPOINT_GRACE_HOURS = { post: 12, story: 0.9 } as const;

export function checkpointsFor(mediaType: PostMediaType | null): readonly Checkpoint[] {
  return mediaType === "STORY" ? STORY_CHECKPOINTS : POST_CHECKPOINTS;
}

function lastCheckpointHours(mediaType: PostMediaType | null): number {
  return checkpointsFor(mediaType).at(-1)?.hours ?? 0;
}

/** Otomatik çekim penceresinin sonu: son kontrol noktası + pay. */
export function autoCollectDeadline(publishedAt: Date, mediaType: PostMediaType | null): Date {
  const grace = mediaType === "STORY" ? FINAL_CHECKPOINT_GRACE_HOURS.story : FINAL_CHECKPOINT_GRACE_HOURS.post;
  return new Date(publishedAt.getTime() + (lastCheckpointHours(mediaType) + grace) * HOUR_MS);
}

export function ageHours(publishedAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - publishedAt.getTime()) / HOUR_MS);
}

/**
 * Şu an karşılanması gereken kontrol noktası: geçilmiş en son nokta, ondan sonra henüz çekim yapılmamışsa.
 * Pencere dışındaysa (çok eski) ya da ilk nokta henüz gelmediyse `null`.
 */
export function dueCheckpoint(publishedAt: Date, mediaType: PostMediaType | null, lastCapturedAt: Date | null, now: Date): Checkpoint | null {
  if (now.getTime() > autoCollectDeadline(publishedAt, mediaType).getTime()) return null;
  const passed = checkpointsFor(mediaType).filter((checkpoint) => publishedAt.getTime() + checkpoint.hours * HOUR_MS <= now.getTime());
  const latest = passed.at(-1);
  if (!latest) return null;
  const latestAt = publishedAt.getTime() + latest.hours * HOUR_MS;
  return lastCapturedAt === null || lastCapturedAt.getTime() < latestAt ? latest : null;
}

/** Bir sonraki çekim zamanı: henüz gelmemiş ilk kontrol noktası; takvim bittiyse `null`. */
export function nextCheckpointAt(publishedAt: Date, mediaType: PostMediaType | null, now: Date): Date | null {
  const next = checkpointsFor(mediaType).find((checkpoint) => publishedAt.getTime() + checkpoint.hours * HOUR_MS > now.getTime());
  return next ? new Date(publishedAt.getTime() + next.hours * HOUR_MS) : null;
}

/** En son yakalanan noktanın etiketi (çekim anında) — snapshot'a yazılır. */
export function checkpointLabelAt(publishedAt: Date, mediaType: PostMediaType | null, now: Date): string | null {
  return checkpointsFor(mediaType).filter((checkpoint) => publishedAt.getTime() + checkpoint.hours * HOUR_MS <= now.getTime()).at(-1)?.label ?? null;
}

/** X: aynı gönderi 1 saatten sık çekilmez (kredi koruması, bkz. CLAUDE.md 4.5). */
export const X_MIN_REFRESH_MS = HOUR_MS;

export function refreshedTooRecently(lastCapturedAt: Date | null, now: Date, minIntervalMs: number): boolean {
  return lastCapturedAt !== null && now.getTime() - lastCapturedAt.getTime() < minIntervalMs;
}
