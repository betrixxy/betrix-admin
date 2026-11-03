-- Kadro doğruluğu: videodaki oyuncu–takım eşleşmesi güncel kadrodan doğrulanır, önbellek en fazla 7 gün.
-- Yalnız yeni tablo ve boş kolon; ReelSnapshot değiştirilemezlik trigger'ı satır güncellemeyi engeller, kolon eklemeyi değil.

-- CreateTable
CREATE TABLE "ReelSquadCheck" (
    "teamId" INTEGER NOT NULL,
    "players" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReelSquadCheck_pkey" PRIMARY KEY ("teamId")
);

-- AlterTable
ALTER TABLE "ReelSnapshot" ADD COLUMN "squadCheckedAt" TIMESTAMP(3);
