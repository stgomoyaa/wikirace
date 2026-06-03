-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "startTitle" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "optimalLen" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "shortestPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "type" TEXT,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Puzzle_status_difficulty_idx" ON "Puzzle"("status", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_lang_startTitle_targetTitle_key" ON "Puzzle"("lang", "startTitle", "targetTitle");

