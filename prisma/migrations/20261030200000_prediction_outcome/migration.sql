-- Tahmin Karnesi sonuç tablosu (bkz. CLAUDE.md 1.10, `lib/prediction/settle.ts`): tuttu / tutmadı / sonuçlanmadı.
-- Yalnızca ekleme: yeni tür + yeni tablo + yalnızca bu tabloya bağlı trigger'lar. PredictionRecord'a DOKUNULMAZ
-- (sütun, veri, trigger aynen; yabancı anahtar yalnızca bu tabloda — ekleme sırasında kaydı UPDATE etmez).
-- Değişmezlik: PredictionRecord ile aynı yol — UPDATE/DELETE/TRUNCATE reddedilir. Skor düzeltmesi ya da
-- değerlendirici değişikliği aynı kayıt için YENİ satır yazar (revision + 1); karne en yüksek revizyonu okur.
-- Geri dönüş: DROP TRIGGER "PredictionOutcome_no_truncate" ON "PredictionOutcome"; DROP TRIGGER "PredictionOutcome_immutable" ON "PredictionOutcome"; DROP FUNCTION "prediction_outcome_immutable"(); DROP TABLE "PredictionOutcome"; DROP TYPE "PredictionOutcomeStatus";

-- CreateEnum
CREATE TYPE "PredictionOutcomeStatus" AS ENUM ('HIT', 'MISS', 'VOID');

-- CreateTable
CREATE TABLE "PredictionOutcome" (
    "id" TEXT NOT NULL,
    "predictionRecordId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "PredictionOutcomeStatus" NOT NULL,
    "fixtureStatus" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "htHomeGoals" INTEGER,
    "htAwayGoals" INTEGER,
    "evaluatorVersion" TEXT NOT NULL,
    "note" TEXT,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionOutcome_fixtureId_idx" ON "PredictionOutcome"("fixtureId");

-- CreateIndex
CREATE INDEX "PredictionOutcome_kickoffAt_idx" ON "PredictionOutcome"("kickoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionOutcome_predictionRecordId_revision_key" ON "PredictionOutcome"("predictionRecordId", "revision");

-- AddForeignKey
ALTER TABLE "PredictionOutcome" ADD CONSTRAINT "PredictionOutcome_predictionRecordId_fkey" FOREIGN KEY ("predictionRecordId") REFERENCES "PredictionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Revizyon 1'den başlar; sonuçlanan (HIT/MISS) satırda normal süre skoru zorunlu.
ALTER TABLE "PredictionOutcome" ADD CONSTRAINT "PredictionOutcome_revision_check" CHECK ("revision" >= 1);
ALTER TABLE "PredictionOutcome" ADD CONSTRAINT "PredictionOutcome_score_check" CHECK ("status" = 'VOID' OR ("homeGoals" IS NOT NULL AND "awayGoals" IS NOT NULL));

-- Değişmezlik: sonuç satırı yazıldıktan sonra güncellenemez ve silinemez (düzeltme = yeni revizyon).
CREATE FUNCTION "prediction_outcome_immutable"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'PredictionOutcome değiştirilemez (%): düzeltme yeni revizyon olarak eklenir', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PredictionOutcome_immutable"
    BEFORE UPDATE OR DELETE ON "PredictionOutcome"
    FOR EACH ROW EXECUTE FUNCTION "prediction_outcome_immutable"();

-- TRUNCATE satır trigger'larını atlar — deyim düzeyinde ayrıca engellenir.
CREATE TRIGGER "PredictionOutcome_no_truncate"
    BEFORE TRUNCATE ON "PredictionOutcome"
    FOR EACH STATEMENT EXECUTE FUNCTION "prediction_outcome_immutable"();
