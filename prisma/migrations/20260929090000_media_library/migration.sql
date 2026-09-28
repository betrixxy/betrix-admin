-- Medya/referans kütüphanesi — bkz. CLAUDE.md 1.11.

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('LOGO', 'PLAYER', 'REFERENCE');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "category" "MediaCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hasAlpha" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    "teamName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_category_idx" ON "MediaAsset"("category");

-- CreateIndex
CREATE INDEX "MediaAsset_teamId_idx" ON "MediaAsset"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_category_sha256_key" ON "MediaAsset"("category", "sha256");

