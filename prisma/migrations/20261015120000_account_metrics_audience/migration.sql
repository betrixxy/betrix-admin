-- CreateEnum
CREATE TYPE "AudienceKind" AS ENUM ('FOLLOWER', 'ENGAGED');

-- CreateTable
CREATE TABLE "AccountMetricSnapshot" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatformType" NOT NULL,
    "date" DATE NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followerCount" INTEGER,
    "followingCount" INTEGER,
    "mediaCount" INTEGER,
    "reach" INTEGER,
    "views" INTEGER,
    "accountsEngaged" INTEGER,
    "totalInteractions" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "profileLinksTaps" INTEGER,
    "follows" INTEGER,
    "unfollows" INTEGER,
    "backfilled" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,

    CONSTRAINT "AccountMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceSnapshot" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatformType" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "AudienceKind" NOT NULL,
    "timeframe" TEXT NOT NULL,
    "breakdown" TEXT NOT NULL,
    "buckets" JSONB,
    "unavailableReason" TEXT,

    CONSTRAINT "AudienceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountMetricSnapshot_date_idx" ON "AccountMetricSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMetricSnapshot_platform_date_key" ON "AccountMetricSnapshot"("platform", "date");

-- CreateIndex
CREATE INDEX "AudienceSnapshot_platform_capturedAt_idx" ON "AudienceSnapshot"("platform", "capturedAt");

