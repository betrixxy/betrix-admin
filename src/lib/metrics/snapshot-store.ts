import type { Prisma } from "@/generated/prisma/client";
import { socialUseMocks } from "@/lib/env";
import { ageHours } from "@/lib/metrics/schedule";
import { prisma } from "@/lib/prisma";
import type { MappedPostMetrics, MetricTrigger } from "@/types/post-metrics";
import type { PostMediaType, SocialPlatformType } from "@/types/social";

/**
 * `PostMetricSnapshot` yazımının tek noktası. Her çekim yeni satırdır (üzerine yazılmaz); aynı işlemde
 * `PostAnalytics` en son değerlerle güncellenir — platformun vermediği (null) alan önceki değerini korur.
 */

export interface CollectTarget {
  id: string;
  platformType: SocialPlatformType;
  providerPostId: string;
  publishedAt: Date;
  mediaType: PostMediaType | null;
  /** Son çekim (içe aktarma dahil) — X'in "1 saatten sık çekme" koruması bunu kullanır. */
  lastCapturedAt: Date | null;
  /** Son gerçek metrik çekimi (içe aktarma sayaçları hariç) — kademeli takvim bunu kullanır. */
  lastCollectedAt: Date | null;
}

export interface SnapshotWrite {
  target: CollectTarget;
  mapped: MappedPostMetrics;
  trigger: MetricTrigger;
  checkpoint: string | null;
  raw: unknown;
  now: Date;
}

export async function writeSnapshot({ target, mapped, trigger, checkpoint, raw, now }: SnapshotWrite): Promise<void> {
  const { values } = mapped;
  await prisma.$transaction(async (tx) => {
    await tx.postMetricSnapshot.create({
      data: {
        socialPostId: target.id,
        capturedAt: now,
        ageHours: Math.round(ageHours(target.publishedAt, now) * 100) / 100,
        checkpoint,
        trigger,
        ...values,
        metricLevel: mapped.metricLevel,
        raw: raw === undefined ? undefined : (JSON.parse(JSON.stringify(raw)) as Prisma.InputJsonValue),
      },
    });

    const current = await tx.postAnalytics.findUnique({ where: { postId: target.id } });
    // Mock veri elle girilmiş gerçek metriklerin üzerine asla yazılmaz.
    if (socialUseMocks && current?.source === "MANUAL") return;
    const keep = (value: number | null, previous: number | undefined) => value ?? previous ?? 0;
    const data = {
      likes: keep(values.likes, current?.likes),
      comments: keep(values.comments, current?.comments),
      shares: keep(values.shares, current?.shares),
      saves: keep(values.saves, current?.saves),
      views: keep(values.views, current?.views),
      reach: keep(values.reach, current?.reach),
      impressions: keep(values.impressions, current?.impressions),
      watchTimeSeconds: keep(values.watchTimeSeconds, current?.watchTimeSeconds),
      source: socialUseMocks ? ("MOCK" as const) : ("API" as const),
      lastSyncedAt: now,
    };
    await tx.postAnalytics.upsert({ where: { postId: target.id }, update: data, create: { postId: target.id, ...data } });
  });
}

/** Gönderilerin çekim hedefleri (son snapshot zamanıyla). Platform kimliği olmayanlar dahil edilmez. */
export async function loadTargets(where: Prisma.SocialPostWhereInput): Promise<CollectTarget[]> {
  const rows = await prisma.socialPost.findMany({
    where: { ...where, status: "PUBLISHED", publishedAt: { not: null }, providerPostId: { not: null } },
    select: {
      id: true,
      providerPostId: true,
      publishedAt: true,
      mediaType: true,
      platform: { select: { type: true } },
      metricSnapshots: { select: { capturedAt: true, trigger: true }, orderBy: { capturedAt: "desc" }, take: 20 },
    },
  });
  return rows.flatMap((row) =>
    row.providerPostId && row.publishedAt
      ? [
          {
            id: row.id,
            platformType: row.platform.type,
            providerPostId: row.providerPostId,
            publishedAt: row.publishedAt,
            mediaType: row.mediaType,
            lastCapturedAt: row.metricSnapshots[0]?.capturedAt ?? null,
            lastCollectedAt: row.metricSnapshots.find((snapshot) => snapshot.trigger !== "IMPORT")?.capturedAt ?? null,
          },
        ]
      : [],
  );
}
