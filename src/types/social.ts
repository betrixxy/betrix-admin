import type { PostAnalyticsSource } from "@/types/social-connection";

/** Bkz. CLAUDE.md 4.1/4.2 — sosyal medya takvimi ve analitik modülünün kanonik iç tipleri. */

/** prisma `SocialPlatformType` enum'u ile birebir aynı değerler — bkz. prisma/schema.prisma. */
export const SOCIAL_PLATFORM_TYPES = [
  "META_INSTAGRAM",
  "META_FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "X",
] as const;
export type SocialPlatformType = (typeof SOCIAL_PLATFORM_TYPES)[number];

/** prisma `SocialPostStatus` enum'u ile birebir aynı değerler: Hazırlanıyor / Paylaşıldı. */
export const SOCIAL_POST_STATUSES = ["PREPARING", "PUBLISHED"] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export interface PostAnalyticsSummary {
  likes: number;
  comments: number;
  views: number;
  shares: number;
  saves: number;
  /** Erişim — tekil hesap. Platform vermiyorsa 0; oranlarda o zaman izlenme kullanılır. */
  reach: number;
  impressions: number;
  watchTimeSeconds: number;
  source: PostAnalyticsSource;
  /** ISO 8601, UTC */
  lastSyncedAt: string;
}

export interface SocialPlatformRef {
  id: string;
  type: SocialPlatformType;
  displayName: string;
}

export interface SocialPostView {
  id: string;
  fixtureId: string;
  platform: SocialPlatformRef;
  caption: string;
  /** ISO 8601, UTC */
  scheduledFor: string;
  /** ISO 8601, UTC — yalnızca `PUBLISHED` durumunda dolu. */
  publishedAt: string | null;
  status: SocialPostStatus;
  analytics: PostAnalyticsSummary | null;
  aiContentCount: number;
  /** Bu gönderiden checkmatch.net'e gelen tıklama (TrafficLog) sayısı. */
  trafficCount: number;
}

export interface FixtureOption {
  id: string;
  label: string;
}

/** `useActionState` ile kullanılan form aksiyonlarının dönüş tipi. */
export interface SocialActionState {
  error?: string;
  success?: boolean;
  /** Başarılı işlem sonrası kısa bilgi mesajı (ör. senkronizasyon özeti). */
  notice?: string;
}

/* ---------- Takvim ---------- */

export const CALENDAR_VIEWS = ["month", "week", "list"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export interface CalendarSummary {
  preparingCount: number;
  publishedCount: number;
  totalCount: number;
}

/* ---------- Etkileşim ve reklam paneli ---------- */

/** Tablo sıralama ölçütleri — "En Çok Yorum Alan", "En Çok Kaydedilen" vb. */
export const ANALYTICS_SORTS = [
  "engagement",
  "views",
  "comments",
  "saves",
  "shares",
  "likes",
  "reach",
  "clicks",
] as const;
export type AnalyticsSort = (typeof ANALYTICS_SORTS)[number];

export interface AnalyticsOverview {
  publishedCount: number;
  totalViews: number;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  /** (beğeni + yorum + paylaşım + kaydetme) / erişim (erişim yoksa izlenme) — bkz. CLAUDE.md 4.1. */
  engagementRate: number;
  /** Gönderilerden checkmatch.net'e gelen toplam tıklama. */
  totalClicks: number;
  /** tıklama / izlenme — izlenme yoksa 0. */
  clickThroughRate: number;
}

export interface TopPostItem {
  post: SocialPostView;
  engagementRate: number;
  clickThroughRate: number;
}

export interface PlatformPerformance {
  type: SocialPlatformType;
  displayName: string;
  postCount: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number;
}

/* ---------- İçerik stratejisi: hangi istatistik türü etkileşim getiriyor ---------- */

/** Görselde/metinde kullanılan istatistik türleri — `DraftStatSelection` alanlarıyla eşleşir. */
export const CONTENT_STAT_KEYS = ["form", "goals", "xg", "headToHead"] as const;
export type ContentStatKey = (typeof CONTENT_STAT_KEYS)[number];

export interface StatInsight {
  stat: ContentStatKey;
  /** Bu istatistiği içeren / içermeyen (AI içeriği bağlı) yayınlanmış gönderi sayısı. */
  postsWith: number;
  postsWithout: number;
  engagementWith: number;
  engagementWithout: number;
  /** Gönderi başına ortalama yorum / kaydetme (istatistiği içerenlerde). */
  avgCommentsWith: number;
  avgSavesWith: number;
  /** engagementWith / engagementWithout − 1; karşılaştırma grubu boşsa `null`. */
  lift: number | null;
  /** İki gruptan biri yeterli örneklemin altındaysa sonuç yön gösterir, kesin değildir. */
  lowSample: boolean;
}

export interface ContentInsights {
  /** Etkileşim farkına (lift) göre sıralı. */
  stats: StatInsight[];
  /** AI içeriği bağlı ve metriği olan, analize giren gönderi sayısı. */
  analyzedPosts: number;
  /** Yeterli örneklemle en yüksek pozitif lift'e sahip istatistik; yoksa `null`. */
  winner: ContentStatKey | null;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  topPosts: TopPostItem[];
  platforms: PlatformPerformance[];
  insights: ContentInsights;
  sort: AnalyticsSort;
  /** `null` = tüm platformlar. */
  platformFilter: SocialPlatformType | null;
}
