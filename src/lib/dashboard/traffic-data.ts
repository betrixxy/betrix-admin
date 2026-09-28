import { prisma } from "@/lib/prisma";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import {
  TRAFFIC_TIME_ZONE,
  buildDailySeries,
  buildSeries,
  lastDayKeys,
  maskIp,
  startOfDayKey,
  type DailyCounts,
} from "@/lib/dashboard/traffic-stats";
import type {
  RecentVisit,
  TopPageItem,
  TrafficData,
  TrafficGranularity,
  TrafficRange,
  TrafficSourceItem,
  TrafficSourceKey,
} from "@/types/traffic";

const TOP_PAGES_LIMIT = 8;
const RECENT_VISITS_LIMIT = 15;

interface DailyRow {
  day: string;
  visits: number;
  uniques: number;
}

/** Ziyaretleri, geldikleri gönderinin platformuna (yoksa "Doğrudan / Organik") göre gruplar. */
async function getSources(from: Date): Promise<TrafficSourceItem[]> {
  const groups = await prisma.trafficLog.groupBy({
    by: ["postId"],
    where: { visitedAt: { gte: from } },
    _count: { _all: true },
  });

  const postIds = groups.flatMap((group) => (group.postId ? [group.postId] : []));
  const posts = await prisma.socialPost.findMany({
    where: { id: { in: postIds } },
    select: { id: true, platform: { select: { type: true } } },
  });
  const platformByPost = new Map(posts.map((post) => [post.id, post.platform.type]));

  const totals = new Map<TrafficSourceKey, number>();
  for (const group of groups) {
    const key: TrafficSourceKey =
      (group.postId ? platformByPost.get(group.postId) : undefined) ?? "DIRECT";
    totals.set(key, (totals.get(key) ?? 0) + group._count._all);
  }

  return [...totals.entries()]
    .map(([key, visits]) => ({
      key,
      label: key === "DIRECT" ? "Doğrudan / Organik" : PLATFORM_LABELS[key],
      visits,
    }))
    .sort((a, b) => b.visits - a.visits);
}

async function getRecentVisits(): Promise<RecentVisit[]> {
  const rows = await prisma.trafficLog.findMany({
    take: RECENT_VISITS_LIMIT,
    orderBy: { visitedAt: "desc" },
    include: { post: { select: { platform: { select: { type: true } } } } },
  });

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    visitedAt: row.visitedAt.toISOString(),
    sourceLabel: row.post ? PLATFORM_LABELS[row.post.platform.type] : "Doğrudan / Organik",
    isUniqueVisit: row.isUniqueVisit,
    sessionShort: row.sessionId ? row.sessionId.slice(0, 8) : null,
    maskedIp: maskIp(row.ipAddress),
  }));
}

export async function getTrafficData(
  range: TrafficRange,
  granularity: TrafficGranularity,
): Promise<TrafficData> {
  const dayKeys = lastDayKeys(range);
  const firstDayKey = dayKeys[0];
  if (!firstDayKey) throw new Error("Trafik aralığı boş olamaz.");
  const from = startOfDayKey(firstDayKey);

  const [dailyRows, sessionRows, pageGroups, sources, recent] = await Promise.all([
    prisma.$queryRaw<DailyRow[]>`
      SELECT to_char(("visitedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TRAFFIC_TIME_ZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS visits,
             (COUNT(*) FILTER (WHERE "isUniqueVisit"))::int AS uniques
      FROM "TrafficLog"
      WHERE "visitedAt" >= ${from}
      GROUP BY 1
      ORDER BY 1`,
    prisma.$queryRaw<{ sessions: number }[]>`
      SELECT COUNT(DISTINCT "sessionId")::int AS sessions
      FROM "TrafficLog"
      WHERE "visitedAt" >= ${from}`,
    prisma.trafficLog.groupBy({
      by: ["path"],
      where: { visitedAt: { gte: from } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: TOP_PAGES_LIMIT,
    }),
    getSources(from),
    getRecentVisits(),
  ]);

  const counts = new Map<string, DailyCounts>(
    dailyRows.map((row) => [row.day, { visits: row.visits, uniques: row.uniques }]),
  );
  const daily = buildDailySeries(dayKeys, counts);

  const visits = daily.reduce((sum, point) => sum + point.visits, 0);
  const uniques = daily.reduce((sum, point) => sum + point.uniques, 0);
  const socialVisits = sources
    .filter((source) => source.key !== "DIRECT")
    .reduce((sum, source) => sum + source.visits, 0);

  const topPages: TopPageItem[] = pageGroups.map((group) => ({
    path: group.path,
    visits: group._count._all,
  }));

  return {
    range,
    granularity,
    totals: {
      visits,
      uniques,
      sessions: sessionRows[0]?.sessions ?? 0,
      socialShare: visits > 0 ? socialVisits / visits : 0,
    },
    series: buildSeries(granularity, daily),
    topPages,
    sources,
    recent,
  };
}
