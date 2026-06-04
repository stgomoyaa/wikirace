import { applyDelta } from './tiers'
import { RrChange } from './elo'

export interface RatingState {
  points: number; mmr: number; placementsDone: number
  shields: number; winStreak: number; peakPoints: number
}
const PLACEMENTS_REQUIRED = 5

/** Aplica el resultado de una carrera ranked al estado de rating. Puro. */
export function applyResult(state: RatingState, change: RrChange): RatingState {
  const mmr = Math.max(0, state.mmr + change.mmrDelta)
  const winStreak = change.won ? state.winStreak + 1 : 0
  if (state.placementsDone < PLACEMENTS_REQUIRED) {
    const placementsDone = state.placementsDone + 1
    const revealed = placementsDone >= PLACEMENTS_REQUIRED
    const points = revealed ? mmr : 0
    return { ...state, mmr, placementsDone, winStreak, points, peakPoints: Math.max(state.peakPoints, points) }
  }
  const { points, shields } = applyDelta(state.points, change.rrDelta, state.shields)
  return { ...state, mmr, points, shields, winStreak, peakPoints: Math.max(state.peakPoints, points) }
}
