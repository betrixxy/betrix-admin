-- Maç önü vitrin kartı: onaylanan tahminlerin DEĞİŞTİRİLEMEZ kaydı (bkz. CLAUDE.md 1.10, Tahmin Karnesi).
-- Yalnızca ekleme: yeni tablo + yalnızca bu tabloya bağlı trigger; mevcut tablo ve veri değişmez.
-- Geri dönüş: DROP TRIGGER "PredictionRecord_no_truncate" ON "PredictionRecord"; DROP TRIGGER "PredictionRecord_immutable" ON "PredictionRecord"; DROP FUNCTION "prediction_record_immutable"(); DROP TABLE "PredictionRecord";

-- CreateTable
CREATE TABLE "PredictionRecord" (
    "id" TEXT NOT NULL,
    "aiContentId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "outcome" JSONB NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "outcomeProbabilities" JSONB NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionRecord_fixtureId_idx" ON "PredictionRecord"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionRecord_aiContentId_scenarioId_key" ON "PredictionRecord"("aiContentId", "scenarioId");

-- Değişmezlik: kayıt yazıldıktan sonra güncellenemez ve silinemez.
CREATE FUNCTION "prediction_record_immutable"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'PredictionRecord değiştirilemez (%): tahmin kaydı yalnızca eklenir', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PredictionRecord_immutable"
    BEFORE UPDATE OR DELETE ON "PredictionRecord"
    FOR EACH ROW EXECUTE FUNCTION "prediction_record_immutable"();

-- TRUNCATE satır trigger'larını atlar — deyim düzeyinde ayrıca engellenir.
CREATE TRIGGER "PredictionRecord_no_truncate"
    BEFORE TRUNCATE ON "PredictionRecord"
    FOR EACH STATEMENT EXECUTE FUNCTION "prediction_record_immutable"();
