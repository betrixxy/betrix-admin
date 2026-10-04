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
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

const ZERO: EngagementInput = { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 };

export function metricsOf(post: SocialPostView): EngagementInput {
  return post.analytics ?? ZERO;
}

/** Etkileşim = beğeni + yorum + paylaşım + kaydetme. */
export function interactionsOf({ likes, comments, shares, saves }: EngagementInput): number {
  return likes + comments + shares + saves;
}

/**
 * Oranın paydası: erişim (CLAUDE.md 4.1). Erişimi vermeyen platformlarda (TikTok, elle girilmiş
 * eski kayıtlar) izlenmeye düşülür — aksi halde bu gönderiler oranda hep 0 görünürdü.
 */
export function audienceOf({ reach, views }: EngagementInput): number {
  return reach > 0 ? reach : views;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Tek gönderi için etkileşim / erişim. */
export function engagementRateOf(input: EngagementInput): number {
  return ratio(interactionsOf(input), audienceOf(input));
}

/**
 * Gönderi grubunun toplu etkileşim oranı: toplam etkileşim / toplam kitle. Gönderi başına
 * oranların ortalaması değildir — 50 izlenmeli bir gönderi 50 bin izlenmelinin ağırlığını taşımaz.
 */
export function pooledEngagementRate(posts: SocialPostView[]): number {
  let interactions = 0;
  let audience = 0;
  for (const post of posts) {
    const metrics = metricsOf(post);
    interactions += interactionsOf(metrics);
    audience += audienceOf(metrics);
  }
  return ratio(interactions, audience);
}

/** Yalnızca yayınlanmış gönderiler performans hesabına girer. */
export function publishedOnly(posts: SocialPostView[]): SocialPostView[] {
  return posts.filter((post) => post.status === "PUBLISHED");
}

const sumOf = (posts: SocialPostView[], pick: (post: SocialPostView) => number) =>
  posts.reduce((total, post) => total + pick(post), 0);

export function computeOverview(posts: SocialPostView[]): AnalyticsOverview {
  const published = publishedOnly(posts);
  const totalViews = sumOf(published, (post) => metricsOf(post).views);
  const totalClicks = sumOf(published, (post) => post.trafficCount);

  return {
    publishedCount: published.length,
    totalViews,
    totalReach: sumOf(published, (post) => metricsOf(post).reach),
    totalLikes: sumOf(published, (post) => metricsOf(post).likes),
    totalComments: sumOf(published, (post) => metricsOf(post).comments),
    totalShares: sumOf(published, (post) => metricsOf(post).shares),
    totalSaves: sumOf(published, (post) => metricsOf(post).saves),
    engagementRate: pooledEngagementRate(published),
    totalClicks,
    clickThroughRate: ratio(totalClicks, totalViews),
  };
}

const SORT_KEYS: Record<AnalyticsSort, (item: TopPostItem) => number> = {
  engagement: (item) => item.engagementRate,
  views: (item) => metricsOf(item.post).views,
  comments: (item) => metricsOf(item.post).comments,
  saves: (item) => metricsOf(item.post).saves,
  shares: (item) => metricsOf(item.post).shares,
  likes: (item) => metricsOf(item.post).likes,
  reach: (item) => metricsOf(item.post).reach,
  clicks: (item) => item.post.trafficCount,
};

export function computeTopPosts(posts: SocialPostView[], sort: AnalyticsSort): TopPostItem[] {
  const sortKey = SORT_KEYS[sort];
  return publishedOnly(posts)
    .map((post) => ({
      post,
      engagementRate: engagementRateOf(metricsOf(post)),
      clickThroughRate: ratio(post.trafficCount, metricsOf(post).views),
    }))
    .sort((a, b) => sortKey(b) - sortKey(a))
    .slice(0, TOP_POSTS_LIMIT);
}

/** Veritabanında henüz kaydı olmayan platformlar da 0 değerleriyle listelenir. */
export function computePlatformPerformance(posts: SocialPostView[]): PlatformPerformance[] {
  const published = publishedOnly(posts);

  return SOCIAL_PLATFORM_TYPES.map((type) => {
    const platformPosts = published.filter((post) => post.platform.type === type);
    const sum = (pick: (post: SocialPostView) => number) => sumOf(platformPosts, pick);

    return {
      type,
      displayName: PLATFORM_LABELS[type],
      postCount: platformPosts.length,
      views: sum((post) => metricsOf(post).views),
      likes: sum((post) => metricsOf(post).likes),
      comments: sum((post) => metricsOf(post).comments),
      shares: sum((post) => metricsOf(post).shares),
      saves: sum((post) => metricsOf(post).saves),
      clicks: sum((post) => post.trafficCount),
      engagementRate: pooledEngagementRate(platformPosts),
    };
  });
}
