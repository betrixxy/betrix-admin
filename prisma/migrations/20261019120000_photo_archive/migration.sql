-- Fotoğraf ARŞİVİ: League / Team / Person / Photo (bkz. CLAUDE.md 1.11).
-- Yalnızca ekleme: yeni enum'lar ve tablolar; mevcut tablo ve veri (MediaAsset dahil) değişmez.
-- Geri dönüş: DROP TABLE "Photo", "Person", "Team", "League"; DROP TYPE "PhotoKind", "PersonPosition", "PersonRole";

-- CreateEnum
CREATE TYPE "PersonRole" AS ENUM ('PLAYER', 'COACH');
-- CreateEnum
CREATE TYPE "PersonPosition" AS ENUM ('GK', 'DEF', 'MID', 'FWD');
-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('CELEBRATION', 'PORTRAIT', 'ACTION', 'TEAM');
-- CreateTable
CREATE TABLE "League" (
    "id" INTEGER NOT NULL,
    "officialName" TEXT NOT NULL,
    "country" TEXT,
    "logoUrl" TEXT,
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL,
    "officialName" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "country" TEXT,
    "national" BOOLEAN NOT NULL DEFAULT false,
    "currentLeagueId" INTEGER,
    "squadSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "apiId" INTEGER NOT NULL,
    "role" "PersonRole" NOT NULL,
    "position" "PersonPosition",
    "apiName" TEXT NOT NULL,
    "officialName" TEXT NOT NULL,
    "nameOverride" TEXT,
    "currentTeamId" INTEGER,
    "nationalTeamId" INTEGER,
    "pendingTeamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "teamId" INTEGER NOT NULL,
    "kitTeamId" INTEGER NOT NULL,
    "fixtureId" TEXT,
    "kind" "PhotoKind" NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "credit" TEXT NOT NULL DEFAULT '',
    "takenAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalUrl" TEXT NOT NULL,
    "upscaledUrl" TEXT,
    "sha256" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "legacyAssetId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Team_currentLeagueId_idx" ON "Team"("currentLeagueId");
-- CreateIndex
CREATE INDEX "Person_currentTeamId_idx" ON "Person"("currentTeamId");
-- CreateIndex
CREATE INDEX "Person_nationalTeamId_idx" ON "Person"("nationalTeamId");
-- CreateIndex
CREATE UNIQUE INDEX "Person_apiId_role_key" ON "Person"("apiId", "role");
-- CreateIndex
CREATE UNIQUE INDEX "Photo_legacyAssetId_key" ON "Photo"("legacyAssetId");
-- CreateIndex
CREATE INDEX "Photo_personId_idx" ON "Photo"("personId");
-- CreateIndex
CREATE INDEX "Photo_teamId_idx" ON "Photo"("teamId");
-- CreateIndex
CREATE INDEX "Photo_fixtureId_idx" ON "Photo"("fixtureId");
-- CreateIndex
CREATE INDEX "Photo_kitTeamId_idx" ON "Photo"("kitTeamId");
-- CreateIndex
CREATE UNIQUE INDEX "Photo_sha256_personId_teamId_key" ON "Photo"("sha256", "personId", "teamId");
-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_currentLeagueId_fkey" FOREIGN KEY ("currentLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_currentTeamId_fkey" FOREIGN KEY ("currentTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_nationalTeamId_fkey" FOREIGN KEY ("nationalTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_pendingTeamId_fkey" FOREIGN KEY ("pendingTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_kitTeamId_fkey" FOREIGN KEY ("kitTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
