-- CreateEnum
CREATE TYPE "ReelProjectStatus" AS ENUM ('SELECTED', 'SNAPSHOT_READY', 'SCRIPT_DRAFT', 'APPROVED', 'RENDERING', 'READY', 'FAILED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "ReelProject" (
    "id" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "leagueName" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "homeName" TEXT NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "awayName" TEXT NOT NULL,
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "publishFrom" TIMESTAMP(3) NOT NULL,
    "publishTo" TIMESTAMP(3) NOT NULL,
    "status" "ReelProjectStatus" NOT NULL DEFAULT 'SELECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReelProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualityOk" BOOLEAN NOT NULL,
    "sceneAvailability" JSONB NOT NULL,

    CONSTRAINT "ReelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReelProject_matchId_key" ON "ReelProject"("matchId");

-- CreateIndex
CREATE INDEX "ReelProject_kickoffUtc_idx" ON "ReelProject"("kickoffUtc");

-- CreateIndex
CREATE UNIQUE INDEX "ReelSnapshot_projectId_version_key" ON "ReelSnapshot"("projectId", "version");

-- AddForeignKey
ALTER TABLE "ReelSnapshot" ADD CONSTRAINT "ReelSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ReelProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Değişmezlik: dondurulan sürüm güncellenemez ve silinemez (düzeltme = yeni sürüm).
CREATE FUNCTION "reel_snapshot_immutable"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'ReelSnapshot değiştirilemez (%): yeni sürüm olarak dondurulur', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReelSnapshot_immutable"
    BEFORE UPDATE OR DELETE ON "ReelSnapshot"
    FOR EACH ROW EXECUTE FUNCTION "reel_snapshot_immutable"();

-- TRUNCATE satır trigger'larını atlar: deyim düzeyinde ayrıca engellenir.
CREATE TRIGGER "ReelSnapshot_no_truncate"
    BEFORE TRUNCATE ON "ReelSnapshot"
    FOR EACH STATEMENT EXECUTE FUNCTION "reel_snapshot_immutable"();

-- Proje onaylandıktan sonra yeni sürüm eklenemez (kural `lib/reels/selection.ts::canFreezeReel` ile aynı).
CREATE FUNCTION "reel_snapshot_require_open_project"() RETURNS trigger AS $$
DECLARE
    current_status "ReelProjectStatus";
BEGIN
    SELECT "status" INTO current_status FROM "ReelProject" WHERE "id" = NEW."projectId" FOR SHARE;
    IF current_status NOT IN ('SELECTED', 'SNAPSHOT_READY', 'SCRIPT_DRAFT') THEN
        RAISE EXCEPTION 'Proje % durumunda: yeni veri dondurulamaz', current_status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReelSnapshot_require_open_project"
    BEFORE INSERT ON "ReelSnapshot"
    FOR EACH ROW EXECUTE FUNCTION "reel_snapshot_require_open_project"();
