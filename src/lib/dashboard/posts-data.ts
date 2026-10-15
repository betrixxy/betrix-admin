import { getPostSiteDetail, getPostSiteStats, type PostSiteDetail } from "@/lib/dashboard/site-attribution";
import { ensurePostShortLink, type ShortLinkView } from "@/lib/dashboard/short-link";
import type { PostListRow } from "@/lib/dashboard/posts-list";
import { engagementRateByReach } from "@/lib/metrics/post-performance";
import { prisma } from "@/lib/prisma";
import { POST_METRIC_FIELDS, type PostMetricValues } from "@/types/post-metrics";

/** Gönderiler sayfası ve gönderi detayının veri yükleyicileri (bkz. CLAUDE.md 1.8 — sorgular `*-data.ts`'te). */

export async function getPostListRows(): Promise<PostListRow[]> {
  const [posts, site] = await Promise.all([
    prisma.socialPost.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        source: true,
        publishedAt: true,
        thumbnailUrl: true,
        permalink: true,
        mediaType: true,
        platform: { select: { type: true } },
        analytics: true,
        features: { select: { contentType: true } },
        aiContents: { select: { contentType: true }, take: 1, orderBy: { updatedAt: "desc" } },
      },
    }),
    getPostSiteStats(),
  ]);
  return posts.map((post) => {
    const a = post.analytics;
    const stats = site.get(post.id);
    return {
      id: post.id,
      platform: post.platform.type,
      source: post.source,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      thumbnailUrl: post.thumbnailUrl,
      permalink: post.permalink,
      mediaType: post.mediaType,
      contentType: post.features?.contentType ?? post.aiContents[0]?.contentType ?? null,
      likes: a?.likes ?? 0,
      comments: a?.comments ?? 0,
      shares: a?.shares ?? 0,
      saves: a?.saves ?? 0,
      reach: a?.reach ?? 0,
      views: a ? Math.max(a.views, a.impressions) : 0,
      engagementRate: a ? engagementRateByReach({ ...a, reach: a.reach || null, views: a.views || null, impressions: a.impressions || null }) : null,
      linkClicks: stats?.linkClicks ?? 0,
      siteVisitors: stats?.uniqueVisitors ?? 0,
      lastSyncedAt: a?.lastSyncedAt.toISOString() ?? null,
    };
  });
}

export interface MetricPoint extends PostMetricValues {
  ageHours: number;
  capturedAt: string;
  checkpoint: string | null;
  trigger: string;
}

export interface PostDetail {
  id: string;
  platform: PostListRow["platform"];
  source: PostListRow["source"];
  caption: string;
  publishedAt: string | null;
  permalink: string | null;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  mediaType: PostListRow["mediaType"];
  aiContentId: string | null;
  features: Awaited<ReturnType<typeof prisma.postFeatures.findUnique>>;
  points: MetricPoint[];
  site: PostSiteDetail;
  shortLink: ShortLinkView | null;
  job: { status: string; nextRunAt: string; lastError: string | null } | null;
}

const metricSelect = Object.fromEntries(POST_METRIC_FIELDS.map((field) => [field, true])) as Record<(typeof POST_METRIC_FIELDS)[number], true>;

export async function getPostDetail(id: string): Promise<PostDetail | null> {
  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: {
      id: true,
      source: true,
      caption: true,
      publishedAt: true,
      permalink: true,
      mediaUrls: true,
      thumbnailUrl: true,
      mediaType: true,
      platform: { select: { type: true } },
      features: true,
      aiContents: { select: { id: true }, take: 1, orderBy: { updatedAt: "desc" } },
      metricSnapshots: { select: { ...metricSelect, ageHours: true, capturedAt: true, checkpoint: true, trigger: true }, orderBy: { capturedAt: "asc" } },
    },
  });
  if (!post) return null;
  const [site, shortLink, job] = await Promise.all([
    getPostSiteDetail(id),
    ensurePostShortLink(id),
    prisma.metricJob.findUnique({ where: { kind_target: { kind: "POST_METRICS", target: id } }, select: { status: true, nextRunAt: true, lastError: true } }),
  ]);
  return {
    id: post.id,
    platform: post.platform.type,
    source: post.source,
    caption: post.caption,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    permalink: post.permalink,
    mediaUrls: post.mediaUrls,
    thumbnailUrl: post.thumbnailUrl,
    mediaType: post.mediaType,
    aiContentId: post.aiContents[0]?.id ?? null,
    features: post.features,
    points: post.metricSnapshots.map((snapshot) => ({ ...snapshot, capturedAt: snapshot.capturedAt.toISOString() })),
    site,
    shortLink,
    job: job ? { status: job.status, nextRunAt: job.nextRunAt.toISOString(), lastError: job.lastError } : null,
  };
}
