-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'PREP_EDITED';

-- AlterTable
ALTER TABLE "Packet" ADD COLUMN "prepMaterial" TEXT;

-- CreateTable
CREATE TABLE "PrepRead" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userId" TEXT,
    "firstReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxScrollPct" INTEGER NOT NULL DEFAULT 0,
    "maxScrollAt" TIMESTAMP(3),
    "secondsTotal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrepRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepRead_packetId_idx" ON "PrepRead"("packetId");

-- CreateIndex
CREATE INDEX "PrepRead_userEmail_idx" ON "PrepRead"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PrepRead_packetId_userEmail_key" ON "PrepRead"("packetId", "userEmail");

-- AddForeignKey
ALTER TABLE "PrepRead" ADD CONSTRAINT "PrepRead_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
