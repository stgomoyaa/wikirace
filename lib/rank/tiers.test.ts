import { describe, it, expect } from 'vitest'
import { tierFromPoints, tierFloor, applyDelta, rankLabel } from './tiers'

describe('tierFromPoints', () => {
  it('Iron IV en 0', () => { expect(tierFromPoints(0)).toMatchObject({ tier: 'Iron', division: 4, rr: 0 }) })
  it('Iron III en 150', () => { expect(tierFromPoints(150)).toMatchObject({ tier: 'Iron', division: 3, rr: 50 }) })
  it('Bronze IV en 400', () => { expect(tierFromPoints(400)).toMatchObject({ tier: 'Bronze', division: 4, rr: 0 }) })
  it('Diamond I justo antes de Master', () => { expect(tierFromPoints(2799)).toMatchObject({ tier: 'Diamond', division: 1, rr: 99 }) })
  it('Master sin división', () => { expect(tierFromPoints(2900)).toMatchObject({ tier: 'Master', division: 0, rr: 100 }) })
  it('Grandmaster arriba de 3300', () => { expect(tierFromPoints(3500)).toMatchObject({ tier: 'Grandmaster', division: 0, rr: 200 }) })
})
describe('tierFloor', () => {
  it('piso de Gold', () => { expect(tierFloor(1350)).toBe(1200) })
})
describe('applyDelta', () => {
  it('suma normal', () => { expect(applyDelta(150, 30, 0)).toEqual({ points: 180, shields: 0 }) })
  it('no baja de 0', () => { expect(applyDelta(10, -50, 0)).toEqual({ points: 0, shields: 0 }) })
  it('un escudo absorbe caída de tier y se consume', () => { expect(applyDelta(1210, -30, 1)).toEqual({ points: 1200, shields: 0 }) })
  it('sin escudos cae de tier', () => { expect(applyDelta(1210, -30, 0)).toEqual({ points: 1180, shields: 0 }) })
})
describe('rankLabel', () => {
  it('con división', () => { expect(rankLabel(150)).toBe('Iron III · 50 RR') })
  it('ápex', () => { expect(rankLabel(2900)).toBe('Master · 100 RR') })
})
