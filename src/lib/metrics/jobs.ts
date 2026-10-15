import type { MetricJobKind } from "@/generated/prisma/client";
import { STALE_LOCK_MS, type JobUpdate } from "@/lib/metrics/job-policy";
import { dueCheckpoint, nextCheckpointAt } from "@/lib/metrics/schedule";
import { loadTargets } from "@/lib/metrics/snapshot-store";
import { prisma } from "@/lib/prisma";
import type { SocialPlatformType } from "@/types/social";

/**
 * `MetricJob` tablosunun tek erişim noktası: işlerin oluşturulması (idempotent), vadesi gelenlerin
 * kilitlenerek alınması ve sonucun yazılması.
 */

const DAY_MS = 86_400_000;
/** Otomatik gönderi takibi penceresi (30 g + pay). */
const POST_WINDOW_DAYS = 31;
const METRIC_PLATFORMS: readonly SocialPlatformType[] = ["META_INSTAGRAM", "X"];

export interface ClaimedJob {
  id: string;
  kind: MetricJobKind;
  target: string;
  platform: SocialPlatformType | null;
  attempts: number;
}

/** Hesap işleri bağlı platformlar için, gönderi işleri takibi süren gönderiler için açılır; var olana dokunulmaz. */
export async function ensureJobs(now: Date): Promise<void> {
  // Süreç yarıda öldüyse RUNNING'de kalan işler kuyruğa döner.
  await prisma.metricJob.updateMany({ where: { status: "RUNNING", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } }, data: { status: "PENDING", lockedAt: null } });

  const connections = await prisma.socialConnection.findMany({ where: { platform: { in: [...METRIC_PLATFORMS] } }, select: { platform: true, connectedAt: true } });
  const accountJobs: { kind: MetricJobKind; target: string; platform: SocialPlatformType }[] = [];
  for (const { platform } of connections) {
    accountJobs.push({ kind: "ACCOUNT_DAILY", target: platform, platform });
    if (platform === "META_INSTAGRAM") {
      accountJobs.push({ kind: "AUDIENCE_WEEKLY", target: platform, platform }, { kind: "ACCOUNT_BACKFILL", target: platform, platform });
    }
  }
  if (accountJobs.length > 0) await prisma.metricJob.createMany({ data: accountJobs.map((job) => ({ ...job, nextRunAt: now })), skipDuplicates: true });

  // Hesap yeniden bağlandıysa durdurulmuş işler kaldığı yerden devam eder.
  for (const { platform, connectedAt } of connections) {
    await prisma.metricJob.updateMany({ where: { platform, status: "BLOCKED", updatedAt: { lt: connectedAt } }, data: { status: "PENDING", attempts: 0, nextRunAt: now, lastError: null } });
  }

  await ensurePostJobs(now, connections.map((row) => row.platform));
}

async function ensurePostJobs(now: Date, platforms: readonly SocialPlatformType[]): Promise<void> {
  if (platforms.length === 0) return;
  const candidates = await loadTargets({ publishedAt: { gte: new Date(now.getTime() - POST_WINDOW_DAYS * DAY_MS) }, platform: { type: { in: [...platforms] } } });
  if (candidates.length === 0) return;
  const existing = new Set(
    (await prisma.metricJob.findMany({ where: { kind: "POST_METRICS", target: { in: candidates.map((target) => target.id) } }, select: { target: true } })).map((job) => job.target),
  );
  const data = candidates.flatMap((target) => {
    if (existing.has(target.id)) return [];
    const due = dueCheckpoint(target.publishedAt, target.mediaType, target.lastCollectedAt, now);
    const nextRunAt = due ? now : nextCheckpointAt(target.publishedAt, target.mediaType, now);
    return nextRunAt ? [{ kind: "POST_METRICS" as const, target: target.id, platform: target.platformType, nextRunAt }] : [];
  });
  if (data.length > 0) await prisma.metricJob.createMany({ data, skipDuplicates: true });
}

/** Vadesi gelen işleri RUNNING yapıp döner — eşzamanlı tetiklemeler aynı işi almaz (SKIP LOCKED). */
export async function claimDueJobs(now: Date, limit: number): Promise<ClaimedJob[]> {
  return prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "MetricJob" SET "status" = 'RUNNING', "lockedAt" = ${now}, "updatedAt" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "MetricJob"
      WHERE "status" = 'PENDING' AND "nextRunAt" <= ${now}
      ORDER BY "nextRunAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "kind", "target", "platform", "attempts"`;
}

export async function finishJob(id: string, update: JobUpdate, now: Date): Promise<void> {
  await prisma.metricJob.update({
    where: { id },
    data: {
      status: update.status,
      attempts: update.attempts,
      nextRunAt: update.nextRunAt,
      lastError: update.lastError?.slice(0, 500) ?? null,
      lockedAt: null,
      lastRunAt: now,
      ...(update.succeeded ? { lastSuccessAt: now } : {}),
    },
  });
}

/** Süre bütçesi dolunca alınmış ama çalıştırılmamış işler kuyruğa geri bırakılır. */
export async function releaseJobs(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.metricJob.updateMany({ where: { id: { in: [...ids] }, status: "RUNNING" }, data: { status: "PENDING", lockedAt: null } });
}

/** Panel: başarısız işleri elle yeniden kuyruğa al. */
export async function retryFailedJobs(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.metricJob.updateMany({ where: { status: "FAILED" }, data: { status: "PENDING", attempts: 0, nextRunAt: now, lastError: null } });
  return count;
}
