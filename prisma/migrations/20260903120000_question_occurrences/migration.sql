-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "lastAskedAt" TIMESTAMP(3),
ADD COLUMN     "occurrences" INTEGER NOT NULL DEFAULT 1;

