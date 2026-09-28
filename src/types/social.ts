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

export const ANALYTICS_SORTS = ["engagement", "views", "clicks"] as const;
export type AnalyticsSort = (typeof ANALYTICS_SORTS)[number];

export interface AnalyticsOverview {
  publishedCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  /** (beğeni + yorum + paylaşım) / izlenme — izlenme yoksa 0. */
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
  clicks: number;
  engagementRate: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  topPosts: TopPostItem[];
  platforms: PlatformPerformance[];
  sort: AnalyticsSort;
}
