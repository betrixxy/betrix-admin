import { prisma } from "@/lib/prisma";
import type { PostExportInput } from "@/lib/dashboard/posts-export";
import { FIRST_HOUR_MAX_AGE } from "@/lib/metrics/post-performance";
import { POST_METRIC_FIELDS, type PostMetricValues } from "@/types/post-metrics";

/** CSV dışa aktarımının veri yükleyicisi — tüm gönderiler (PANEL + IMPORTED), yayın zamanına göre yeniden eskiye. */

type SnapshotRow = Record<(typeof POST_METRIC_FIELDS)[number], number | null> & { capturedAt: Date; ageHours: number; metricLevel: string | null };

const metricSelect = Object.fromEntries(POST_METRIC_FIELDS.map((field) => [field, true])) as Record<(typeof POST_METRIC_FIELDS)[number], true>;

function values(row: SnapshotRow): PostMetricValues {
  return Object.fromEntries(POST_METRIC_FIELDS.map((field) => [field, row[field]])) as PostMetricValues;
}

export async function loadPostExport(siteStats?: ReadonlyMap<string, NonNullable<PostExportInput["site"]>>): Promise<PostExportInput[]> {
  const posts = await prisma.socialPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      source: true,
      publishedAt: true,
      permalink: true,
      mediaType: true,
      caption: true,
      platform: { select: { type: true } },
      features: true,
      metricSnapshots: { select: { ...metricSelect, capturedAt: true, ageHours: true, metricLevel: true }, orderBy: { capturedAt: "desc" } },
    },
  });
  return posts.map((post) => {
    const latest = post.metricSnapshots[0];
    return {
      id: post.id,
      platform: post.platform.type,
      source: post.source,
      publishedAt: post.publishedAt,
      permalink: post.permalink,
      mediaType: post.mediaType,
      caption: post.caption,
      features: post.features,
      latest: latest ? { ...values(latest), capturedAt: latest.capturedAt, ageHours: latest.ageHours, metricLevel: latest.metricLevel } : null,
      snapshots: post.metricSnapshots.filter((row) => row.ageHours <= FIRST_HOUR_MAX_AGE).map((row) => ({ ...values(row), ageHours: row.ageHours })),
      site: siteStats?.get(post.id) ?? null,
    };
  });
}
