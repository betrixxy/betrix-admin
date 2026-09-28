import { prisma } from "@/lib/prisma";
import {
  computeOverview,
  computePlatformPerformance,
  computeTopPosts,
} from "@/lib/dashboard/analytics-stats";
import { postInclude, toPostView } from "@/lib/dashboard/post-view";
import type { AnalyticsData, AnalyticsSort } from "@/types/social";

/**
 * Yayınlanmış gönderilerin performans verisi. Metrikler şu an `PostAnalytics`'e elle
 * girilir; Meta/TikTok API'leri bağlandığında aynı tabloyu senkronizasyon dolduracak
 * (bkz. CLAUDE.md 4.1 kademeli senkronizasyon), bu fonksiyon değişmeden kalır.
 */
export async function getAnalyticsData(sort: AnalyticsSort): Promise<AnalyticsData> {
  const rows = await prisma.socialPost.findMany({
    where: { status: "PUBLISHED" },
    include: postInclude,
  });
  const posts = rows.map(toPostView);

  return {
    overview: computeOverview(posts),
    topPosts: computeTopPosts(posts, sort),
    platforms: computePlatformPerformance(posts),
    sort,
  };
}
