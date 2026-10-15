import type { PublishLayout, PublishPlatform } from "@/types/publishing";
import type { PostMediaType, SocialPlatformType } from "@/types/social";

/** Yayın Merkezi hedefi → SocialPost alanları. Saf fonksiyonlar (sunucu bağımlılığı yok). */

export const PUBLISH_TO_PLATFORM_TYPE: Record<PublishPlatform, SocialPlatformType> = {
  IG_POST: "META_INSTAGRAM",
  IG_REELS_STORY: "META_INSTAGRAM",
  X: "X",
};

/** IG_REELS_STORY Yayın Merkezi'nde hikâye olarak paylaşılır (bkz. social/publish.ts). */
export function publishedMediaType(platform: PublishPlatform, layout: PublishLayout, mediaCount: number): PostMediaType {
  if (platform === "IG_REELS_STORY") return "STORY";
  if (mediaCount === 0) return "TEXT";
  return layout === "multi" && mediaCount > 1 ? "CAROUSEL" : "IMAGE";
}

/**
 * Taslağa bağlı takvim gönderisi yeniden kullanılabilir mi: aynı platformda ve henüz bir platform
 * gönderisine bağlanmamış olmalı. Aksi halde paylaşım için yeni bir SocialPost açılır.
 */
export function canReuseLinkedPost(linked: { platformType: SocialPlatformType; providerPostId: string | null } | null, platformType: SocialPlatformType): boolean {
  return linked !== null && linked.platformType === platformType && linked.providerPostId === null;
}
