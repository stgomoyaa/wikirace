import { describe, it, expect } from 'vitest'
import { buildShareCard, formatTime } from './card'

describe('formatTime', () => {
  it('formatea ms a M:SS', () => { expect(formatTime(51_000)).toBe('0:51'); expect(formatTime(125_000)).toBe('2:05') })
})
describe('buildShareCard', () => {
  it('incluye número, estrellas, tiempo y cuadros', () => {
    const card = buildShareCard({ number: 123, stars: 2, timeMs: 51_000, clicks: 5, optimalLen: 4, url: 'https://wikirace.app' })
    expect(card).toContain('WikiRace #123')
    expect(card).toContain('⭐⭐')
    expect(card).toContain('0:51')
    expect(card).toContain('5 saltos (óptimo 4)')
    expect(card).toContain('🟩🟩🟩🟩🟨')
    expect(card).toContain('https://wikirace.app')
  })
})
