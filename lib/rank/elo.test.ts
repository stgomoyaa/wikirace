import { describe, it, expect } from 'vitest'
import { computeRrChange } from './elo'

const base = { stars: 1 as 1 | 2 | 3, points: 1000, mmr: 1000, isPlacement: false, winStreak: 0 }

describe('computeRrChange', () => {
  it('gana RR si bate el par', () => {
    const r = computeRrChange({ ...base, timeMs: 30_000, parMs: 60_000 })
    expect(r.won).toBe(true); expect(r.rrDelta).toBeGreaterThan(0)
  })
  it('pierde RR si va más lento que el par', () => {
    const r = computeRrChange({ ...base, timeMs: 90_000, parMs: 60_000 })
    expect(r.won).toBe(false); expect(r.rrDelta).toBeLessThan(0)
  })
  it('3 estrellas dan más que 1 al ganar', () => {
    const a = computeRrChange({ ...base, stars: 1, timeMs: 30_000, parMs: 60_000 })
    const b = computeRrChange({ ...base, stars: 3, timeMs: 30_000, parMs: 60_000 })
    expect(b.rrDelta).toBeGreaterThan(a.rrDelta)
  })
  it('convergencia: MMR muy por encima del rank gana más', () => {
    const low = computeRrChange({ ...base, mmr: 1000, timeMs: 30_000, parMs: 60_000 })
    const high = computeRrChange({ ...base, mmr: 1500, timeMs: 30_000, parMs: 60_000 })
    expect(high.rrDelta).toBeGreaterThan(low.rrDelta)
  })
  it('placements mueven el MMR más rápido (x2)', () => {
    const normal = computeRrChange({ ...base, timeMs: 30_000, parMs: 60_000 })
    const place = computeRrChange({ ...base, isPlacement: true, timeMs: 30_000, parMs: 60_000 })
    expect(Math.abs(place.mmrDelta)).toBeGreaterThan(Math.abs(normal.mmrDelta))
  })
})
