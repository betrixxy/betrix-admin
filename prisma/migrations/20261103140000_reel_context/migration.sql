-- AlterTable
ALTER TABLE "ReelProject" ADD COLUMN "analystNote" TEXT;

-- AlterTable
ALTER TABLE "ReelSnapshot" ADD COLUMN "context" JSONB,
ADD COLUMN "contextFetchedAt" TIMESTAMP(3);
