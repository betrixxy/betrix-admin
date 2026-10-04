import type { PostAnalyticsSource } from "@/types/social-connection";
import type { AnalyticsSort, ContentStatKey, SocialPlatformType, SocialPostStatus } from "@/types/social";

/** Etkileşim panelindeki sıralama sekmeleri. */
export const SORT_LABELS: Record<AnalyticsSort, string> = {
  engagement: "Etkileşim Oranı",
  views: "En Çok İzlenen",
  comments: "En Çok Yorum Alan",
  saves: "En Çok Kaydedilen",
  shares: "En Çok Paylaşılan",
  likes: "En Çok Beğenilen",
  reach: "En Geniş Erişim",
  clicks: "En Çok Tıklanan",
};

export const STAT_LABELS: Record<ContentStatKey, string> = {
  form: "Form (son 5 maç)",
  goals: "Gol ortalamaları",
  xg: "xG (beklenen gol)",
  headToHead: "Aralarındaki maçlar (H2H)",
};

export const ANALYTICS_SOURCE_LABELS: Record<PostAnalyticsSource, string> = {
  MANUAL: "elle girildi",
  API: "API",
  MOCK: "mock veri",
};

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
