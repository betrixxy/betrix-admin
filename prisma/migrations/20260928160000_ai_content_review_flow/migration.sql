-- İnsan onaylı (human-in-the-loop) taslak akışı — bkz. CLAUDE.md 1.10.

-- CreateEnum
CREATE TYPE "AiContentStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AiContent" ADD COLUMN     "backgroundImageUrl" TEXT,
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "renderOptions" JSONB,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "statsSnapshot" JSONB,
ADD COLUMN     "status" "AiContentStatus" NOT NULL DEFAULT 'DRAFT';

-- Bu migration'dan önceki kayıtlar onay akışı yokken "nihai" olarak üretildi;
-- onay kuyruğuna düşmesinler diye APPROVED sayılır.
UPDATE "AiContent" SET "status" = 'APPROVED', "reviewedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "AiContent_status_idx" ON "AiContent"("status");
