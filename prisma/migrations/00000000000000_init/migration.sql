-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LEARNER');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('ACADEMY', 'DEVOPS', 'AIML', 'DSML');

-- CreateEnum
CREATE TYPE "YoeBucket" AS ENUM ('LT2', 'B2_5', 'GT5');

-- CreateEnum
CREATE TYPE "SourceMode" AS ENUM ('SHEET_ONLY', 'SHEET_PLUS_WEB');

-- CreateEnum
CREATE TYPE "PacketStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('SHEET', 'WEB', 'JD_SPILLOVER', 'MANUAL');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProblemLinkSource" AS ENUM ('LEETCODE', 'GFG', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('INITIAL', 'APPEND');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStep" AS ENUM ('LOAD_SHEET', 'SCOPE_FILTER', 'READABILITY', 'WEB_RESEARCH', 'MERGE', 'NAME_ROUNDS', 'JD_SPILLOVER', 'PROBLEM_LINKS', 'FINALIZE', 'DONE');

-- CreateEnum
CREATE TYPE "LlmPurpose" AS ENUM ('SCOPE_FILTER', 'READABILITY', 'WEB_RESEARCH', 'MERGE', 'NAME_ROUNDS', 'PROBLEM_LINKS', 'JD_SPILLOVER', 'LINK_LOOKUP');

-- CreateEnum
CREATE TYPE "MatchedInterview" AS ENUM ('YES', 'PARTLY', 'NO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'LEARNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Packet" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "company" TEXT NOT NULL,
    "companyNorm" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleNorm" TEXT NOT NULL,
    "yoeBucket" "YoeBucket" NOT NULL,
    "stack" TEXT,
    "location" TEXT NOT NULL DEFAULT 'India',
    "jdText" TEXT,
    "jdFileName" TEXT,
    "jdSummary" TEXT,
    "sourceMode" "SourceMode" NOT NULL DEFAULT 'SHEET_ONLY',
    "allowHigherCost" BOOLEAN NOT NULL DEFAULT false,
    "status" "PacketStatus" NOT NULL DEFAULT 'DRAFT',
    "lifetimeCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSheetRowDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Packet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "duration" TEXT,
    "isSpillover" BOOLEAN NOT NULL DEFAULT false,
    "sheetKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "originalText" TEXT NOT NULL,
    "improvedText" TEXT NOT NULL,
    "displayText" TEXT NOT NULL,
    "editedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "problemLink" TEXT,
    "problemLinkSource" "ProblemLinkSource",
    "normalizedText" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sheetRef" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressedQuestion" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "step" "JobStep" NOT NULL DEFAULT 'LOAD_SHEET',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stepLabel" TEXT NOT NULL DEFAULT 'Queued',
    "log" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "scratch" JSONB,
    "stats" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "packetId" TEXT,
    "purpose" "LlmPurpose" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketRead" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userId" TEXT,
    "firstReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readDays" INTEGER NOT NULL DEFAULT 1,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PacketRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketReadDay" (
    "id" TEXT NOT NULL,
    "packetReadId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "PacketReadDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "matched" "MatchedInterview" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetSnapshot" (
    "id" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastReadsSyncAt" TIMESTAMP(3),
    "lastFeedbackSyncAt" TIMESTAMP(3),

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Packet_slug_key" ON "Packet"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Packet_track_companyNorm_roleNorm_yoeBucket_key" ON "Packet"("track", "companyNorm", "roleNorm", "yoeBucket");

-- CreateIndex
CREATE INDEX "Round_packetId_idx" ON "Round"("packetId");

-- CreateIndex
CREATE INDEX "Question_packetId_idx" ON "Question"("packetId");

-- CreateIndex
CREATE INDEX "Question_roundId_idx" ON "Question"("roundId");

-- CreateIndex
CREATE INDEX "Question_packetId_normalizedText_idx" ON "Question"("packetId", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressedQuestion_packetId_normalizedText_key" ON "SuppressedQuestion"("packetId", "normalizedText");

-- CreateIndex
CREATE INDEX "GenerationJob_packetId_idx" ON "GenerationJob"("packetId");

-- CreateIndex
CREATE INDEX "LlmCall_jobId_idx" ON "LlmCall"("jobId");

-- CreateIndex
CREATE INDEX "LlmCall_packetId_idx" ON "LlmCall"("packetId");

-- CreateIndex
CREATE INDEX "PacketRead_packetId_idx" ON "PacketRead"("packetId");

-- CreateIndex
CREATE INDEX "PacketRead_userEmail_idx" ON "PacketRead"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PacketRead_packetId_userEmail_key" ON "PacketRead"("packetId", "userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PacketReadDay_packetReadId_day_key" ON "PacketReadDay"("packetReadId", "day");

-- CreateIndex
CREATE INDEX "Feedback_packetId_idx" ON "Feedback"("packetId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_packetId_userEmail_key" ON "Feedback"("packetId", "userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "SheetSnapshot_tab_key" ON "SheetSnapshot"("tab");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuppressedQuestion" ADD CONSTRAINT "SuppressedQuestion_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketRead" ADD CONSTRAINT "PacketRead_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketReadDay" ADD CONSTRAINT "PacketReadDay_packetReadId_fkey" FOREIGN KEY ("packetReadId") REFERENCES "PacketRead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "Packet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
