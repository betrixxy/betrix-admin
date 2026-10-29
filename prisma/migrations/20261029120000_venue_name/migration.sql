-- Stadyum kart adı düzeltmesi (admin, Kütüphane → Ad Raporu). Yalnızca ekleme: yeni tablo, mevcut
-- tablolara dokunulmaz. Geri dönüş: DROP TABLE "VenueName";

-- CreateTable
CREATE TABLE "VenueName" (
    "apiName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueName_pkey" PRIMARY KEY ("apiName")
);
