-- İçerik türü kataloğu (lib/dashboard/content-types.ts) + ileriye dönük yayın planlaması.
-- Yalnızca eklenebilir (nullable) sütunlar; mevcut veri silinmez veya değişmez.

-- AlterTable
ALTER TABLE "AiContent" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "publishAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AiContent_fixtureId_contentType_idx" ON "AiContent"("fixtureId", "contentType");

-- CreateIndex
CREATE INDEX "AiContent_publishAt_idx" ON "AiContent"("publishAt");

-- Mevcut Maç Günü kartları (renderOptions.kind = MATCH_DAY) katalog kimliğine bağlanır;
-- diğer (genel stüdyo) taslaklar katalogdan önce üretildiği için null kalır.
UPDATE "AiContent" SET "contentType" = 'MATCH_DAY' WHERE "renderOptions"->>'kind' = 'MATCH_DAY';
