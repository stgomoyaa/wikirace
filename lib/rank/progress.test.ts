import { describe, it, expect } from 'vitest'
import { applyResult, RatingState } from './progress'

const fresh: RatingState = { points: 0, mmr: 1000, placementsDone: 0, shields: 0, winStreak: 0, peakPoints: 0 }

describe('applyResult', () => {
  it('durante placements mueve MMR pero no revela puntos hasta la 5ª', () => {
    let s: RatingState = { ...fresh }
    for (let i = 0; i < 4; i++) {
      s = applyResult(s, { rrDelta: 20, mmrDelta: 20, won: true })
      expect(s.points).toBe(0)
    }
    expect(s.placementsDone).toBe(4)
    s = applyResult(s, { rrDelta: 20, mmrDelta: 20, won: true })
    expect(s.placementsDone).toBe(5)
    expect(s.points).toBe(s.mmr)
  })
  it('tras placements aplica rrDelta a los puntos', () => {
    const placed: RatingState = { ...fresh, placementsDone: 5, points: 1000, mmr: 1000 }
    const s = applyResult(placed, { rrDelta: 25, mmrDelta: 25, won: true })
    expect(s.points).toBe(1025)
  })
  it('cuenta racha y la corta al perder', () => {
    let s: RatingState = { ...fresh, placementsDone: 5, points: 1000 }
    s = applyResult(s, { rrDelta: 20, mmrDelta: 20, won: true })
    expect(s.winStreak).toBe(1)
    s = applyResult(s, { rrDelta: -20, mmrDelta: -20, won: false })
    expect(s.winStreak).toBe(0)
  })
  it('actualiza peakPoints', () => {
    const placed: RatingState = { ...fresh, placementsDone: 5, points: 1000, peakPoints: 1000 }
    const s = applyResult(placed, { rrDelta: 30, mmrDelta: 30, won: true })
    expect(s.peakPoints).toBe(1030)
  })
})
