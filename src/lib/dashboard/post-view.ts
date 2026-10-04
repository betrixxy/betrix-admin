import type { Prisma } from "@/generated/prisma/client";
import type { SocialPostView } from "@/types/social";

export const postInclude = {
  platform: true,
  analytics: true,
  _count: { select: { aiContents: true, trafficLogs: true } },
} satisfies Prisma.SocialPostInclude;

export type SocialPostRow = Prisma.SocialPostGetPayload<{ include: typeof postInclude }>;

export function toPostView(row: SocialPostRow): SocialPostView {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    platform: {
      id: row.platform.id,
      type: row.platform.type,
      displayName: row.platform.displayName,
    },
    caption: row.caption,
    scheduledFor: row.scheduledFor.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    status: row.status,
    analytics: row.analytics
      ? {
          likes: row.analytics.likes,
          comments: row.analytics.comments,
          views: row.analytics.views,
          shares: row.analytics.shares,
          saves: row.analytics.saves,
          reach: row.analytics.reach,
          impressions: row.analytics.impressions,
          watchTimeSeconds: row.analytics.watchTimeSeconds,
          source: row.analytics.source,
          lastSyncedAt: row.analytics.lastSyncedAt.toISOString(),
        }
      : null,
    aiContentCount: row._count.aiContents,
    trafficCount: row._count.trafficLogs,
  };
}
