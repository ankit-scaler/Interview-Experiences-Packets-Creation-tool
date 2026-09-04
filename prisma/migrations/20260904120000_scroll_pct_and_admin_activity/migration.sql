-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('PACKET_CREATED', 'PACKET_EDITED', 'PACKET_DELETED', 'PACKET_PUBLISHED', 'PACKET_UNPUBLISHED', 'GENERATION_STARTED', 'REGENERATION_STARTED', 'ROUND_ADDED', 'ROUND_EDITED', 'ROUND_DELETED', 'QUESTION_ADDED', 'QUESTION_EDITED', 'QUESTION_DELETED');

-- AlterTable
ALTER TABLE "PacketRead" ADD COLUMN     "scrollPct" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AdminActivity" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" "AdminAction" NOT NULL,
    "packetId" TEXT,
    "packetLabel" TEXT NOT NULL,
    "packetSlug" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActivity_createdAt_idx" ON "AdminActivity"("createdAt");

-- CreateIndex
CREATE INDEX "AdminActivity_actorEmail_idx" ON "AdminActivity"("actorEmail");

-- CreateIndex
CREATE INDEX "AdminActivity_packetId_idx" ON "AdminActivity"("packetId");
