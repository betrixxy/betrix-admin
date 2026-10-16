-- Maç Sonucu: oyuncu fotoğrafı ↔ API-Football oyuncu kimliği (MVP fotoğrafı bununla bulunur).
-- Yalnızca eklenebilir (nullable) sütunlar + indeks; mevcut veri silinmez veya değişmez.

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "playerId" INTEGER,
ADD COLUMN     "playerName" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_playerId_idx" ON "MediaAsset"("playerId");
