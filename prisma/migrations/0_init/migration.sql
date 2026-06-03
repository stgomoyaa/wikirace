-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "startTitle" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "timeMs" INTEGER,
    "clicks" INTEGER,
    "path" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

