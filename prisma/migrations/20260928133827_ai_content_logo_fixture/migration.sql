/*
  Warnings:

  - You are about to drop the column `sourceImageUrl` on the `AiContent` table. All the data in the column will be lost.
  - Added the required column `fixtureId` to the `AiContent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiContent" DROP COLUMN "sourceImageUrl",
ADD COLUMN     "fixtureId" TEXT NOT NULL,
ADD COLUMN     "logoImageUrl" TEXT,
ADD COLUMN     "playerImageUrl" TEXT;

-- CreateIndex
CREATE INDEX "AiContent_fixtureId_idx" ON "AiContent"("fixtureId");
