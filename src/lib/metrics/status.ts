import { connectionWarning, type ConnectionWarning } from "@/lib/metrics/job-policy";
import { prisma } from "@/lib/prisma";
import { getXUsageToday, type XUsageToday } from "@/lib/services/social/x-usage";
import type { SocialPlatformType } from "@/types/social";

/**
 * Etkileşim panelindeki "veri toplama durumu": son başarılı çekim, bekleyen/başarısız/durdurulmuş işler,
 * X günlük okuma kullanımı ve token bitiş uyarıları. Token içermez.
 */

export interface JobIssue {
  id: string;
  kind: string;
  target: string;
  platform: SocialPlatformType | null;
  status: "FAILED" | "BLOCKED";
  attempts: number;
  lastError: string | null;
  lastRunAt: string | null;
}

export interface CollectionStatus {
  lastSuccessAt: string | null;
  pending: number;
  issues: JobIssue[];
  failedCount: number;
  blockedCount: number;
  xUsage: XUsageToday;
  xLimitReached: boolean;
  /** Ertelenmiş (X sınırı vb.) iş sayısı — son hata metniyle. */
  deferredByBudget: number;
  connectionWarnings: { platform: SocialPlatformType; accountName: string | null; warning: ConnectionWarning }[];
}

export async function getCollectionStatus(now: Date = new Date()): Promise<CollectionStatus> {
  const [last, pending, issues, failedCount, blockedCount, deferredByBudget, xUsage, connections] = await Promise.all([
    prisma.metricJob.findFirst({ where: { lastSuccessAt: { not: null } }, orderBy: { lastSuccessAt: "desc" }, select: { lastSuccessAt: true } }),
    prisma.metricJob.count({ where: { status: { in: ["PENDING", "RUNNING"] }, nextRunAt: { lte: now } } }),
    prisma.metricJob.findMany({ where: { status: { in: ["FAILED", "BLOCKED"] } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.metricJob.count({ where: { status: "FAILED" } }),
    prisma.metricJob.count({ where: { status: "BLOCKED" } }),
    prisma.metricJob.count({ where: { status: "PENDING", lastError: { contains: "X_DAILY_READ_LIMIT" } } }),
    getXUsageToday(now),
    prisma.socialConnection.findMany({ select: { platform: true, accountName: true, expiresAt: true, refreshToken: true } }),
  ]);
  return {
    lastSuccessAt: last?.lastSuccessAt?.toISOString() ?? null,
    pending,
    issues: issues.map((job) => ({
      id: job.id,
      kind: job.kind,
      target: job.target,
      platform: job.platform,
      status: job.status === "BLOCKED" ? "BLOCKED" : "FAILED",
      attempts: job.attempts,
      lastError: job.lastError,
      lastRunAt: job.lastRunAt?.toISOString() ?? null,
    })),
    failedCount,
    blockedCount,
    xUsage,
    xLimitReached: xUsage.posts >= xUsage.limit,
    deferredByBudget,
    connectionWarnings: connections.flatMap((connection) => {
      const warning = connectionWarning(connection.expiresAt, connection.refreshToken !== null, now);
      return warning ? [{ platform: connection.platform, accountName: connection.accountName, warning }] : [];
    }),
  };
}
