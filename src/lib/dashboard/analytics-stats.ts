import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import {
  SOCIAL_PLATFORM_TYPES,
  type AnalyticsOverview,
  type AnalyticsSort,
  type PlatformPerformance,
  type SocialPostView,
  type TopPostItem,
} from "@/types/social";

const TOP_POSTS_LIMIT = 10;

interface EngagementInput {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

/** (beğeni + yorum + paylaşım) / izlenme — izlenme yoksa 0. */
export function engagementRateOf({ views, likes, comments, shares }: EngagementInput): number {
  return views > 0 ? (likes + comments + shares) / views : 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Yalnızca yayınlanmış gönderiler performans hesabına girer. */
export function publishedOnly(posts: SocialPostView[]): SocialPostView[] {
  return posts.filter((post) => post.status === "PUBLISHED");
}

export function computeOverview(posts: SocialPostView[]): AnalyticsOverview {
  const published = publishedOnly(posts);
  const totals = { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };

  for (const post of published) {
    totals.views += post.analytics?.views ?? 0;
    totals.likes += post.analytics?.likes ?? 0;
    totals.comments += post.analytics?.comments ?? 0;
    totals.shares += post.analytics?.shares ?? 0;
    totals.clicks += post.trafficCount;
  }

  return {
    publishedCount: published.length,
    totalViews: totals.views,
    totalLikes: totals.likes,
    totalComments: totals.comments,
    totalShares: totals.shares,
    engagementRate: engagementRateOf(totals),
    totalClicks: totals.clicks,
    clickThroughRate: ratio(totals.clicks, totals.views),
  };
}

const SORT_KEYS: Record<AnalyticsSort, (item: TopPostItem) => number> = {
  engagement: (item) => item.engagementRate,
  views: (item) => item.post.analytics?.views ?? 0,
  clicks: (item) => item.post.trafficCount,
};

export function computeTopPosts(posts: SocialPostView[], sort: AnalyticsSort): TopPostItem[] {
  const sortKey = SORT_KEYS[sort];
  return publishedOnly(posts)
    .map((post) => {
      const views = post.analytics?.views ?? 0;
      return {
        post,
        engagementRate: engagementRateOf({
          views,
          likes: post.analytics?.likes ?? 0,
          comments: post.analytics?.comments ?? 0,
          shares: post.analytics?.shares ?? 0,
        }),
        clickThroughRate: ratio(post.trafficCount, views),
      };
    })
    .sort((a, b) => sortKey(b) - sortKey(a))
    .slice(0, TOP_POSTS_LIMIT);
}

/** Veritabanında henüz kaydı olmayan platformlar da 0 değerleriyle listelenir. */
export function computePlatformPerformance(posts: SocialPostView[]): PlatformPerformance[] {
  const published = publishedOnly(posts);

  return SOCIAL_PLATFORM_TYPES.map((type) => {
    const platformPosts = published.filter((post) => post.platform.type === type);
    const sum = (pick: (post: SocialPostView) => number) =>
      platformPosts.reduce((total, post) => total + pick(post), 0);
    const views = sum((post) => post.analytics?.views ?? 0);
    const likes = sum((post) => post.analytics?.likes ?? 0);
    const comments = sum((post) => post.analytics?.comments ?? 0);
    const shares = sum((post) => post.analytics?.shares ?? 0);

    return {
      type,
      displayName: PLATFORM_LABELS[type],
      postCount: platformPosts.length,
      views,
      likes,
      comments,
      shares,
      clicks: sum((post) => post.trafficCount),
      engagementRate: engagementRateOf({ views, likes, comments, shares }),
    };
  });
}
