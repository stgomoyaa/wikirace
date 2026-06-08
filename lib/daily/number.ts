/** Época del daily #1: 2026-06-01 UTC. */
export const LAUNCH_UTC = Date.UTC(2026, 5, 1)
const DAY_MS = 86_400_000

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
export function dailyNumber(date: Date): number {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((midnight - LAUNCH_UTC) / DAY_MS) + 1
}
export function difficultyForDate(date: Date): 'easy' | 'medium' | 'hard' {
  const dow = date.getUTCDay()
  if (dow === 0 || dow === 6) return 'hard'
  if (dow === 1 || dow === 2) return 'easy'
  return 'medium'
}
