-- Un jugador no puede tener dos carreras daily para el mismo puzzle (cierra el doble-start del daily).
CREATE UNIQUE INDEX "Race_daily_player_puzzle_key"
  ON "Race" ("playerId", "puzzleId")
  WHERE "isDaily" = true;
