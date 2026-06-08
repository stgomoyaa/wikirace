import { describe, it, expect } from 'vitest'
import { dailyNumber, difficultyForDate, utcDateString, LAUNCH_UTC } from './number'

describe('utcDateString', () => {
  it('formatea la fecha en UTC YYYY-MM-DD', () => {
    expect(utcDateString(new Date('2026-06-08T23:30:00Z'))).toBe('2026-06-08')
  })
})
describe('dailyNumber', () => {
  it('el día de lanzamiento es #1', () => { expect(dailyNumber(new Date(LAUNCH_UTC))).toBe(1) })
  it('cuenta días desde el lanzamiento (UTC)', () => {
    expect(dailyNumber(new Date('2026-06-03T05:00:00Z'))).toBe(3)
  })
})
describe('difficultyForDate', () => {
  it('rota por día de la semana (UTC)', () => {
    expect(difficultyForDate(new Date('2026-06-08T12:00:00Z'))).toBe('easy')   // lunes
    expect(difficultyForDate(new Date('2026-06-10T12:00:00Z'))).toBe('medium') // miércoles
    expect(difficultyForDate(new Date('2026-06-13T12:00:00Z'))).toBe('hard')   // sábado
  })
})
