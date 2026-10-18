-- Maç Sonucu tam kadraj: maç fotoğrafı klasörü (MATCH_PHOTO) + maç etiketi (fixtureId).
-- Yalnızca eklenebilir: yeni enum değeri, nullable sütun + indeks; mevcut veri silinmez veya değişmez.
-- Geri dönüş: DROP INDEX "MediaAsset_fixtureId_idx"; ALTER TABLE "MediaAsset" DROP COLUMN "fixtureId";
-- (PostgreSQL enum değeri kaldırılamaz — MATCH_PHOTO kayıtları silinip değer kullanılmadan bırakılır.)

-- AlterEnum
ALTER TYPE "MediaCategory" ADD VALUE 'MATCH_PHOTO';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "fixtureId" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_fixtureId_idx" ON "MediaAsset"("fixtureId");
