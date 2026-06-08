/** Elige un id al azar de los candidatos que NO están en `playedIds`. null si no hay. */
export function chooseUnplayed(
  candidateIds: string[],
  playedIds: string[],
  rnd: () => number = Math.random,
): string | null {
  const played = new Set(playedIds)
  const pool = candidateIds.filter((id) => !played.has(id))
  if (pool.length === 0) return null
  const idx = Math.min(pool.length - 1, Math.floor(rnd() * pool.length))
  return pool[idx]
}
