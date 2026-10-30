-- Kulüp renk tablosu dışındaki takımların rengi: logodan otomatik (AUTO), admin onayıyla APPROVED.
-- Yalnızca ekleme: yeni tür + yeni tablo, mevcut tablolara dokunulmaz.
-- Geri dönüş: DROP TABLE "TeamColor"; DROP TYPE "TeamColorStatus";

-- CreateEnum
CREATE TYPE "TeamColorStatus" AS ENUM ('AUTO', 'APPROVED');

-- CreateTable
CREATE TABLE "TeamColor" (
    "teamId" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "secondary" TEXT NOT NULL,
    "status" "TeamColorStatus" NOT NULL DEFAULT 'AUTO',
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamColor_pkey" PRIMARY KEY ("teamId")
);
