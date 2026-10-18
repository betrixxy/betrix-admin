-- Fotoğraf arşivi: "Etiket bekleyenler" kutusunda eski fotoğrafı arşive almadan gizleme (bkz. CLAUDE.md 1.11).
-- Yalnızca ekleme: boş bırakılabilir tek sütun; mevcut veri değişmez.
-- Geri dönüş: ALTER TABLE "MediaAsset" DROP COLUMN "archiveDismissedAt";

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "archiveDismissedAt" TIMESTAMP(3);
