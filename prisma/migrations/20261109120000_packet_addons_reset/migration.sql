-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE 'PACKET_RESET';

-- AlterTable
ALTER TABLE "Packet" ADD COLUMN "addOns" TEXT;
