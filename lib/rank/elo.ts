export interface RrChangeInput {
  timeMs: number; parMs: number; stars: 1 | 2 | 3
  points: number; mmr: number; isPlacement: boolean; winStreak: number
}
export interface RrChange { rrDelta: number; mmrDelta: number; won: boolean }

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/** Cambio de RR/MMR por una carrera ranked, basado en velocidad vs par. Puro. */
export function computeRrChange(input: RrChangeInput): RrChange {
  const { timeMs, parMs, stars, points, mmr, isPlacement, winStreak } = input
  const won = timeMs <= parMs
  const speedScore = clamp((parMs - timeMs) / parMs, -1, 1)
  let base = Math.round(speedScore * 25)
  let mmrDelta = base
  if (base > 0) {
    base += stars === 3 ? 5 : stars === 2 ? 2 : 0
    if (winStreak >= 2) base += Math.min(winStreak, 5)
  }
  const gap = mmr - points
  if (gap > 0) {
    const factor = Math.min(gap, 500) / 500
    if (base > 0) base = Math.round(base * (1 + factor * 0.5))
    else if (base < 0) base = Math.round(base * (1 - factor * 0.5))
  }
  if (isPlacement) { base = Math.round(base * 2); mmrDelta = Math.round(mmrDelta * 2) }
  return { rrDelta: base, mmrDelta, won }
}
