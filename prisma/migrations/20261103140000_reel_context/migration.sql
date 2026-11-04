-- AlterTable
ALTER TABLE "ReelProject" ADD COLUMN "analystScreenNote" TEXT,
ADD COLUMN "analystVoiceNote" TEXT;

-- AlterTable
ALTER TABLE "ReelSnapshot" ADD COLUMN "context" JSONB,
ADD COLUMN "contextFetchedAt" TIMESTAMP(3);
