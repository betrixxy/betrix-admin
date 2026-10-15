-- CreateEnum
CREATE TYPE "LinkPlacement" AS ENUM ('BODY', 'FIRST_REPLY', 'NONE');

-- CreateTable
CREATE TABLE "PostFeatures" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "featureVersion" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedHourIst" INTEGER NOT NULL,
    "weekdayIst" INTEGER NOT NULL,
    "hoursFromKickoff" DOUBLE PRECISION,
    "contentType" TEXT,
    "format" TEXT,
    "templateName" TEXT,
    "mediaCount" INTEGER NOT NULL,
    "captionChars" INTEGER NOT NULL,
    "captionWords" INTEGER NOT NULL,
    "hasQuestion" BOOLEAN NOT NULL,
    "emojiCount" INTEGER NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasLink" BOOLEAN NOT NULL,
    "linkPlacement" "LinkPlacement" NOT NULL,
    "league" TEXT,
    "homeTeam" TEXT,
    "awayTeam" TEXT,
    "isDerby" BOOLEAN,
    "derbyIntensity" TEXT,
    "followersAtPublish" INTEGER,
    "playbookVersion" TEXT,
    "captionModel" TEXT,
    "captionVariant" TEXT,

    CONSTRAINT "PostFeatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostFeatures_socialPostId_key" ON "PostFeatures"("socialPostId");

-- AddForeignKey
ALTER TABLE "PostFeatures" ADD CONSTRAINT "PostFeatures_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

