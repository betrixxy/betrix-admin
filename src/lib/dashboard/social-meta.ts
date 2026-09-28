import type { SocialPlatformType, SocialPostStatus } from "@/types/social";

export const PLATFORM_LABELS: Record<SocialPlatformType, string> = {
  META_INSTAGRAM: "Instagram",
  META_FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X (Twitter)",
};

/** Takvim/tablo rozetlerinde platformu ayırt eden renkli nokta. */
export const PLATFORM_DOT_CLASS: Record<SocialPlatformType, string> = {
  META_INSTAGRAM: "bg-pink-500",
  META_FACEBOOK: "bg-blue-500",
  TIKTOK: "bg-cyan-400",
  YOUTUBE: "bg-red-500",
  X: "bg-zinc-300",
};

export const STATUS_LABELS: Record<SocialPostStatus, string> = {
  PREPARING: "Hazırlanıyor",
  PUBLISHED: "Paylaşıldı",
};

export const STATUS_BADGE_CLASS: Record<SocialPostStatus, string> = {
  PREPARING: "bg-amber-500/15 text-amber-400",
  PUBLISHED: "bg-emerald-500/15 text-emerald-400",
};
