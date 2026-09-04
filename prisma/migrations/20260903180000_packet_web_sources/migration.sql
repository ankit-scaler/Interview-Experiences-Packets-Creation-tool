-- AlterTable
ALTER TABLE "Packet" ADD COLUMN     "webSources" TEXT[] DEFAULT ARRAY[]::TEXT[];
