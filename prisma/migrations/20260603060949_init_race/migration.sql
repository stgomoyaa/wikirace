-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "startTitle" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "timeMs" INTEGER,
    "clicks" INTEGER,
    "path" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT false
);
