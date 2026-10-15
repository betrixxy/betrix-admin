-- CreateEnum
CREATE TYPE "PostSource" AS ENUM ('PANEL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "PostMediaType" AS ENUM ('IMAGE', 'CAROUSEL', 'VIDEO', 'REELS', 'STORY', 'TEXT');

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "mediaType" "PostMediaType",
ADD COLUMN     "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permalink" TEXT,
ADD COLUMN     "source" "PostSource" NOT NULL DEFAULT 'PANEL',
ADD COLUMN     "thumbnailUrl" TEXT,
ALTER COLUMN "fixtureId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "XReadUsage" (
    "day" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "posts" INTEGER NOT NULL DEFAULT 0,
    "users" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XReadUsage_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "SocialPost_publishedAt_idx" ON "SocialPost"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_platformId_providerPostId_key" ON "SocialPost"("platformId", "providerPostId");

