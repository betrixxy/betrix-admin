-- Yayın Merkezi'nden API ile doğrudan paylaşım (Instagram / X).
-- Yalnızca eklenebilir: yeni enum değeri + nullable sütunlar; mevcut veri silinmez veya değişmez.

-- AlterEnum
ALTER TYPE "AiContentStatus" ADD VALUE 'PUBLISHED';

-- AlterTable
ALTER TABLE "AiContent" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedPlatform" TEXT,
ADD COLUMN     "publishedPostId" TEXT,
ADD COLUMN     "publishedUrl" TEXT;
