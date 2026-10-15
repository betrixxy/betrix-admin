-- CreateEnum
CREATE TYPE "MetricTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "MetricLevel" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "PostMetricSnapshot" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ageHours" DOUBLE PRECISION NOT NULL,
    "checkpoint" TEXT,
    "trigger" "MetricTrigger" NOT NULL,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "reach" INTEGER,
    "views" INTEGER,
    "impressions" INTEGER,
    "profileVisits" INTEGER,
    "follows" INTEGER,
    "linkClicks" INTEGER,
    "profileClicks" INTEGER,
    "reposts" INTEGER,
    "quotes" INTEGER,
    "replies" INTEGER,
    "bookmarks" INTEGER,
    "totalInteractions" INTEGER,
    "watchTimeSeconds" INTEGER,
    "metricLevel" "MetricLevel",
    "raw" JSONB,

    CONSTRAINT "PostMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostMetricSnapshot_socialPostId_capturedAt_idx" ON "PostMetricSnapshot"("socialPostId", "capturedAt");

-- CreateIndex
CREATE INDEX "PostMetricSnapshot_capturedAt_idx" ON "PostMetricSnapshot"("capturedAt");

-- AddForeignKey
ALTER TABLE "PostMetricSnapshot" ADD CONSTRAINT "PostMetricSnapshot_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

