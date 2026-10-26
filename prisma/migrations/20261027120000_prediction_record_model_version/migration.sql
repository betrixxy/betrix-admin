-- Tahmin kaydına model sürümü (Tahmin Karnesi sürüme göre ayırır, bkz. CLAUDE.md 1.10).
-- Yalnızca ekleme: nullable sütun, varsayılan yok — mevcut satırlara dokunulmaz (UPDATE yok),
-- eski kayıtlar null kalır (= v1, "poisson-v1"). Değişmezlik trigger'ları (PredictionRecord_immutable,
-- PredictionRecord_no_truncate) aynen kalır; ADD COLUMN satır trigger'ı tetiklemez.
-- Geri dönüş: ALTER TABLE "PredictionRecord" DROP COLUMN "modelVersion";

-- AlterTable
ALTER TABLE "PredictionRecord" ADD COLUMN "modelVersion" TEXT;
