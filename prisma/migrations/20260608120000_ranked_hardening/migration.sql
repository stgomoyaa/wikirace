-- AlterTable: el MMR de un jugador nuevo arranca en 1000 (no 0)
ALTER TABLE "PlayerRating" ALTER COLUMN "mmr" SET DEFAULT 1000;

-- CreateIndex: backstop anti doble-RR (una sola entrada de historial por carrera)
CREATE UNIQUE INDEX "RatingHistory_raceId_key" ON "RatingHistory"("raceId");
