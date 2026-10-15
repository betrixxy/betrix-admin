-- Kısa link + tıklama, TrafficLog UTM/oturum alanları ve ham IP'nin HMAC özetine çevrilmesi (CLAUDE.md 4.3).
--
-- Mevcut TrafficLog.ipAddress değerleri, uygulamanın çalışma anında kullandığı yöntemle (HMAC-SHA256, anahtar
-- IP_HASH_SECRET, hex) özetlenir ve ham IP sütunu kaldırılır. Anahtar migrate bağlantısına
-- `options=-c betrix.ip_hash_secret=<hex>` ile verilir (docker-compose.prod.yml → migrate). Ham IP içeren satır
-- varken anahtar yoksa migration DURUR — ham IP özetlenmeden silinmez, özetsiz de bırakılmaz.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "TrafficLog" ADD COLUMN "ipHash" TEXT;

DO $$
DECLARE
  secret TEXT := current_setting('betrix.ip_hash_secret', true);
BEGIN
  IF EXISTS (SELECT 1 FROM "TrafficLog" WHERE "ipAddress" IS NOT NULL) THEN
    IF secret IS NULL OR length(secret) < 32 THEN
      RAISE EXCEPTION 'TrafficLog içinde ham IP var: migrate bağlantısına IP_HASH_SECRET (betrix.ip_hash_secret) verilmeli.';
    END IF;
    UPDATE "TrafficLog" SET "ipHash" = encode(hmac("ipAddress", secret, 'sha256'), 'hex') WHERE "ipAddress" IS NOT NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "TrafficLog" DROP COLUMN "ipAddress",
ADD COLUMN     "attributionInherited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT,
ADD COLUMN     "visitId" TEXT;
-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "socialPostId" TEXT,
    "aiContentId" TEXT,
    "platform" "SocialPlatformType",
    "contentType" TEXT,
    "targetPath" TEXT NOT NULL DEFAULT '/',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "socialPostId" TEXT,
    "platform" "SocialPlatformType",
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "referrerHost" TEXT,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_socialPostId_key" ON "ShortLink"("socialPostId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_aiContentId_key" ON "ShortLink"("aiContentId");

-- CreateIndex
CREATE INDEX "LinkClick_socialPostId_clickedAt_idx" ON "LinkClick"("socialPostId", "clickedAt");

-- CreateIndex
CREATE INDEX "LinkClick_clickedAt_idx" ON "LinkClick"("clickedAt");

-- CreateIndex
CREATE INDEX "TrafficLog_sessionId_visitedAt_idx" ON "TrafficLog"("sessionId", "visitedAt");

-- CreateIndex
CREATE INDEX "TrafficLog_visitId_idx" ON "TrafficLog"("visitId");

-- CreateIndex
CREATE INDEX "TrafficLog_utmSource_idx" ON "TrafficLog"("utmSource");

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_aiContentId_fkey" FOREIGN KEY ("aiContentId") REFERENCES "AiContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

