import { prisma } from "@/lib/prisma";
import {
  computeOverview,
  computePlatformPerformance,
  computeTopPosts,
} from "@/lib/dashboard/analytics-stats";
import { computeContentInsights, statKeysOf } from "@/lib/dashboard/content-insights-stats";
import { parseRenderOptions } from "@/lib/dashboard/draft-snapshot";
import { postInclude, toPostView } from "@/lib/dashboard/post-view";
import { getPostSiteStats } from "@/lib/dashboard/site-attribution";
import type { AnalyticsData, AnalyticsSort, ContentStatKey, SocialPlatformType } from "@/types/social";
import { isApprovedStatus } from "@/types/ai-content";

/**
 * Yayınlanmış gönderilerin performans verisi. `PostAnalytics` en son metrik snapshot'ının önbelleğidir
 * (otomatik çekim, "Senkronize et" ya da elle giriş); bu fonksiyon kaynaktan bağımsızdır.
 * Platform filtresi özet, tablo ve içerik analizine uygulanır; platform tablosu her zaman tümünü gösterir.
 */
export async function getAnalyticsData(
  sort: AnalyticsSort,
  platformFilter: SocialPlatformType | null = null,
): Promise<AnalyticsData> {
  const rows = await prisma.socialPost.findMany({
    where: { status: "PUBLISHED" },
    include: postInclude,
  });
  // Tıklama: kısa link tıklaması (bot hariç); kısa linki olmayan eski gönderilerde atıflı site ziyareti.
  const linkClicks = await getPostSiteStats(rows.map((row) => row.id));
  const allPosts = rows.map(toPostView).map((post) => {
    const clicks = linkClicks.get(post.id)?.linkClicks ?? 0;
    return clicks > 0 ? { ...post, trafficCount: clicks } : post;
  });
  const posts = platformFilter ? allPosts.filter((post) => post.platform.type === platformFilter) : allPosts;
  const statsByPost = await getStatsByPost(posts.map((post) => post.id));

  return {
    overview: computeOverview(posts),
    topPosts: computeTopPosts(posts, sort),
    platforms: computePlatformPerformance(allPosts),
    insights: computeContentInsights(posts, statsByPost),
    sort,
    platformFilter,
  };
}

/**
 * Gönderi → görselinde kullanılan istatistikler. Gönderiye bağlı onaylı AI içerik varsa yalnızca
 * onaylılar, yoksa taslaklar dikkate alınır; reddedilenler yayınlanmadığı için hiç sayılmaz.
 */
async function getStatsByPost(postIds: string[]): Promise<Map<string, Set<ContentStatKey>>> {
  if (postIds.length === 0) return new Map();

  const contents = await prisma.aiContent.findMany({
    where: { postId: { in: postIds }, status: { not: "REJECTED" } },
    select: { postId: true, status: true, renderOptions: true },
  });

  const hasApproved = new Set(contents.filter((c) => isApprovedStatus(c.status)).map((c) => c.postId));
  const statsByPost = new Map<string, Set<ContentStatKey>>();

  for (const content of contents) {
    if (!content.postId || content.renderOptions === null) continue;
    if (hasApproved.has(content.postId) && !isApprovedStatus(content.status)) continue;

    const keys = statKeysOf(parseRenderOptions(content.renderOptions).selection);
    const existing = statsByPost.get(content.postId) ?? new Set<ContentStatKey>();
    for (const key of keys) existing.add(key);
    statsByPost.set(content.postId, existing);
  }
  return statsByPost;
}
