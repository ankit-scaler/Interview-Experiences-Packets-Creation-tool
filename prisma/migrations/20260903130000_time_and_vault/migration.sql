-- AlterTable
ALTER TABLE "PacketReadDay" ADD COLUMN     "seconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VaultClick" (
    "id" TEXT NOT NULL,
    "packetId" TEXT,
    "userEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "VaultClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultClick_userEmail_idx" ON "VaultClick"("userEmail");

-- CreateIndex
CREATE INDEX "VaultClick_createdAt_idx" ON "VaultClick"("createdAt");

-- AddForeignKey
ALTER TABLE "VaultClick" ADD CONSTRAINT "VaultClick_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

