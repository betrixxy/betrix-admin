import type { SocialPlatformType } from "@/types/social";

/**
 * Bkz. CLAUDE.md 4.1 — sosyal medya OAuth bağlantıları ve metrik senkronizasyonunun
 * kanonik iç tipleri. Sağlayıcıların ham yanıt tipleri `lib/services/social/metrics/raw-types.ts`'tedir.
 */

/** URL'de kullanılan platform kısa adı: `/api/auth/<slug>/connect`. */
export const PLATFORM_SLUGS = ["instagram", "facebook", "tiktok", "youtube", "x"] as const;
export type PlatformSlug = (typeof PLATFORM_SLUGS)[number];

/** prisma `PostAnalyticsSource` enum'u ile birebir aynı değerler. */
export const POST_ANALYTICS_SOURCES = ["MANUAL", "API", "MOCK"] as const;
export type PostAnalyticsSource = (typeof POST_ANALYTICS_SOURCES)[number];

/** Arayüze giden bağlantı özeti — token'lar hiçbir zaman bu tipe girmez. */
export interface SocialConnectionView {
  platform: SocialPlatformType;
  slug: PlatformSlug;
  accountId: string;
  accountName: string | null;
  /** ISO 8601, UTC */
  connectedAt: string;
  expiresAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

/** Arayüzde her platform için gösterilen satır: bağlı mı, OAuth uygulaması yapılandırılmış mı. */
export interface IntegrationStatus {
  platform: SocialPlatformType;
  slug: PlatformSlug;
  name: string;
  description: string;
  /** Mock modunda her zaman `true`; gerçek modda istemci kimliği/sırrı tanımlıysa `true`. */
  configured: boolean;
  connection: SocialConnectionView | null;
}

/** Token değişimi/yenilemesi sonrası servis katmanının döndürdüğü düz (şifresiz) token seti. */
export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

export interface OAuthAccount {
  accountId: string;
  accountName: string | null;
}

/** Tek bir gönderinin platformdan çekilen, kanonik biçimdeki metrikleri. */
export interface PostMetricsSnapshot {
  providerPostId: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  reach: number;
  impressions: number;
  watchTimeSeconds: number;
}

/** Callback'in `/dashboard/analytics`'e döndürdüğü, sabit kümeden seçilen hata kodu (URL'e serbest metin yansıtılmaz). */
export const CONNECT_ERROR_CODES = [
  "not_configured",
  "invalid_state",
  "denied",
  "token_exchange_failed",
  "account_lookup_failed",
  "encryption_unavailable",
] as const;
export type ConnectErrorCode = (typeof CONNECT_ERROR_CODES)[number];

export interface SyncReport {
  /** PostAnalytics'e yazılan gönderi sayısı. */
  updated: number;
  /** Senkronizasyon zamanı gelmediği veya elle girildiği için atlananlar. */
  skipped: number;
  /** Platform bazlı hata mesajları (token yenileme, API hatası vb.). */
  failures: { platform: SocialPlatformType; message: string }[];
}
