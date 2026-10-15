import { ISTANBUL_TZ } from "@/lib/metrics/istanbul-time";
import { prisma } from "@/lib/prisma";
import { UTM_SOURCE } from "@/lib/dashboard/tracking-link";
import type { SocialPlatformType } from "@/types/social";

/**
 * Siteye dönüş (bkz. CLAUDE.md 4.3): gönderi başına kısa link tıklaması, checkmatch.net'e gelen tekil ziyaretçi,
 * oturum ve sayfa; günlük platform özeti. Özet tablo tutulmaz — TrafficLog/LinkClick indeksli ve hacim küçük,
 * sorgu yeterli. Bot olarak işaretlenen tıklamalar sayılmaz.
 */

export interface PostSiteStats {
  linkClicks: number;
  uniqueVisitors: number;
  sessions: number;
  pageviews: number;
}

export async function getPostSiteStats(postIds?: readonly string[]): Promise<Map<string, PostSiteStats>> {
  const filter = postIds ? { in: [...postIds] } : { not: null };
  const [clicks, visits] = await Promise.all([
    prisma.linkClick.groupBy({ by: ["socialPostId"], where: { socialPostId: filter, isBot: false }, _count: { _all: true } }),
    prisma.$queryRaw<{ postId: string; visitors: number; sessions: number; pageviews: number }[]>`
      SELECT "postId",
             COUNT(DISTINCT "sessionId")::int AS visitors,
             COUNT(DISTINCT COALESCE("visitId", "sessionId"))::int AS sessions,
             COUNT(*)::int AS pageviews
      FROM "TrafficLog"
      WHERE "postId" IS NOT NULL
      GROUP BY "postId"`,
  ]);
  const wanted = postIds ? new Set(postIds) : null;
  const stats = new Map<string, PostSiteStats>();
  const entry = (id: string) => stats.get(id) ?? { linkClicks: 0, uniqueVisitors: 0, sessions: 0, pageviews: 0 };
  for (const row of clicks) if (row.socialPostId) stats.set(row.socialPostId, { ...entry(row.socialPostId), linkClicks: row._count._all });
  for (const row of visits) {
    if (wanted && !wanted.has(row.postId)) continue;
    stats.set(row.postId, { ...entry(row.postId), uniqueVisitors: row.visitors, sessions: row.sessions, pageviews: row.pageviews });
  }
  return stats;
}

export interface PostSiteDetail extends PostSiteStats {
  pagesPerSession: number | null;
  topPages: { path: string; views: number }[];
  /** Kısa link tıklamaları gün gün (İstanbul). */
  clicksByDay: { day: string; clicks: number }[];
}

export async function getPostSiteDetail(postId: string): Promise<PostSiteDetail> {
  const [stats, topPages, clicksByDay] = await Promise.all([
    getPostSiteStats([postId]),
    prisma.trafficLog.groupBy({ by: ["path"], where: { postId }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 10 }),
    prisma.$queryRaw<{ day: string; clicks: number }[]>`
      SELECT to_char(("clickedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ISTANBUL_TZ}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS clicks
      FROM "LinkClick" WHERE "socialPostId" = ${postId} AND NOT "isBot"
      GROUP BY 1 ORDER BY 1`,
  ]);
  const base = stats.get(postId) ?? { linkClicks: 0, uniqueVisitors: 0, sessions: 0, pageviews: 0 };
  return {
    ...base,
    pagesPerSession: base.sessions > 0 ? Math.round((base.pageviews / base.sessions) * 100) / 100 : null,
    topPages: topPages.map((row) => ({ path: row.path, views: row._count._all })),
    clicksByDay,
  };
}

export interface SiteDailyRow {
  day: string;
  /** utm_source (instagram, x, …) ya da gönderinin platformu; atıfsız ziyaretler hariç. */
  source: string;
  uniqueVisitors: number;
  sessions: number;
  pageviews: number;
}

/** Sosyal medya kaynaklı günlük site özeti (İstanbul günü × kaynak) — son `days` gün. */
export async function getSiteDailySummary(days: number, now: Date = new Date()): Promise<SiteDailyRow[]> {
  const from = new Date(now.getTime() - days * 86_400_000);
  const rows = await prisma.$queryRaw<{ day: string; source: string | null; platform: SocialPlatformType | null; visitors: number; sessions: number; pageviews: number }[]>`
    SELECT to_char((t."visitedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ISTANBUL_TZ}, 'YYYY-MM-DD') AS day,
           t."utmSource" AS source,
           p."type" AS platform,
           COUNT(DISTINCT t."sessionId")::int AS visitors,
           COUNT(DISTINCT COALESCE(t."visitId", t."sessionId"))::int AS sessions,
           COUNT(*)::int AS pageviews
    FROM "TrafficLog" t
    LEFT JOIN "SocialPost" sp ON sp."id" = t."postId"
    LEFT JOIN "SocialPlatform" p ON p."id" = sp."platformId"
    WHERE t."visitedAt" >= ${from} AND (t."utmSource" IS NOT NULL OR t."postId" IS NOT NULL)
    GROUP BY 1, 2, 3
    ORDER BY 1, 2`;
  return rows.map((row) => ({
    day: row.day,
    source: row.source ?? (row.platform ? UTM_SOURCE[row.platform] : "diğer"),
    uniqueVisitors: row.visitors,
    sessions: row.sessions,
    pageviews: row.pageviews,
  }));
}
