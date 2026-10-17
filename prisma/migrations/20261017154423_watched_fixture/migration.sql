-- CreateTable
CREATE TABLE "WatchedFixture" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "starredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "homeName" TEXT NOT NULL,
    "homeLogo" TEXT NOT NULL,
    "awayName" TEXT NOT NULL,
    "awayLogo" TEXT NOT NULL,
    "leagueId" INTEGER,
    "leagueName" TEXT NOT NULL,
    "round" TEXT,

    CONSTRAINT "WatchedFixture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchedFixture_fixtureId_key" ON "WatchedFixture"("fixtureId");

-- CreateIndex
CREATE INDEX "WatchedFixture_kickoffUtc_idx" ON "WatchedFixture"("kickoffUtc");
