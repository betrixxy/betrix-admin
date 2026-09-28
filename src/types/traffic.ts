/** Bkz. CLAUDE.md 4.3 — checkmatch.net web trafiği (TrafficLog) analiz tipleri. */

import type { SocialPlatformType } from "@/types/social";

export const TRAFFIC_RANGES = [7, 30, 90] as const;
export type TrafficRange = (typeof TRAFFIC_RANGES)[number];

export const TRAFFIC_GRANULARITIES = ["day", "week"] as const;
export type TrafficGranularity = (typeof TRAFFIC_GRANULARITIES)[number];

export interface TrafficSeriesPoint {
  /** Kova anahtarı: gün için `yyyy-MM-dd`, hafta için haftanın pazartesisi. */
  key: string;
  label: string;
  /** Sayfa görüntüleme. */
  visits: number;
  /** Yeni ziyaretçi — kimliği (`sessionId`) ilk kez bu kovada görülen. */
  uniques: number;
}

export interface TopPageItem {
  path: string;
  visits: number;
}

export type TrafficSourceKey = "DIRECT" | SocialPlatformType;

export interface TrafficSourceItem {
  key: TrafficSourceKey;
  label: string;
  visits: number;
}

export interface RecentVisit {
  id: string;
  path: string;
  /** ISO 8601, UTC */
  visitedAt: string;
  sourceLabel: string;
  isUniqueVisit: boolean;
  /** Oturum kimliğinin kısaltılmış hâli — tam değer arayüze taşınmaz. */
  sessionShort: string | null;
  /** Son oktet maskelenmiş IP (KVKK) — örn. `192.168.1.xxx`. */
  maskedIp: string | null;
}

export interface TrafficTotals {
  /** Sayfa görüntüleme. */
  visits: number;
  /** Yeni ziyaretçi — siteye ilk kez gelen (`TrafficLog.isUniqueVisit`). */
  uniques: number;
  /** Tekil ziyaretçi — dönemdeki farklı ziyaretçi kimliği sayısı (izleme kodu kalıcı kimlik üretir). */
  sessions: number;
  /** Sosyal medya gönderilerinden gelen ziyaretlerin oranı (0-1). */
  socialShare: number;
}

export interface TrafficData {
  range: TrafficRange;
  granularity: TrafficGranularity;
  totals: TrafficTotals;
  series: TrafficSeriesPoint[];
  topPages: TopPageItem[];
  sources: TrafficSourceItem[];
  recent: RecentVisit[];
}
