import { describe, it, expect } from 'vitest'
import { recordDaily, emptyDailyState } from './state'

describe('recordDaily', () => {
  it('primer día: streak 1', () => {
    const s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    expect(s.streak).toBe(1); expect(s.maxStreak).toBe(1); expect(s.lastDay).toBe(5); expect(s.history).toHaveLength(1)
  })
  it('día consecutivo: streak +1', () => {
    let s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    s = recordDaily(s, { day: 6, stars: 2, timeMs: 2000, clicks: 4 })
    expect(s.streak).toBe(2); expect(s.maxStreak).toBe(2)
  })
  it('hueco de días: streak vuelve a 1', () => {
    let s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    s = recordDaily(s, { day: 8, stars: 1, timeMs: 3000, clicks: 6 })
    expect(s.streak).toBe(1); expect(s.maxStreak).toBe(1)
  })
  it('mismo día (idempotente): no cambia streak ni duplica historial', () => {
    let s = recordDaily(emptyDailyState(), { day: 5, stars: 3, timeMs: 1000, clicks: 3 })
    s = recordDaily(s, { day: 5, stars: 1, timeMs: 9999, clicks: 9 })
    expect(s.streak).toBe(1); expect(s.history).toHaveLength(1); expect(s.history[0].stars).toBe(3)
  })
})
