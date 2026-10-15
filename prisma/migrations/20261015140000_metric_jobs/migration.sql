-- CreateEnum
CREATE TYPE "MetricJobKind" AS ENUM ('POST_METRICS', 'ACCOUNT_DAILY', 'AUDIENCE_WEEKLY', 'ACCOUNT_BACKFILL');

-- CreateEnum
CREATE TYPE "MetricJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'BLOCKED');

-- CreateTable
CREATE TABLE "MetricJob" (
    "id" TEXT NOT NULL,
    "kind" "MetricJobKind" NOT NULL,
    "target" TEXT NOT NULL,
    "platform" "SocialPlatformType",
    "status" "MetricJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricJob_status_nextRunAt_idx" ON "MetricJob"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetricJob_kind_target_key" ON "MetricJob"("kind", "target");

