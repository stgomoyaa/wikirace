-- AlterTable
ALTER TABLE "Race" ADD COLUMN "isDaily" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Daily" (
    "date" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Daily_pkey" PRIMARY KEY ("date")
);
